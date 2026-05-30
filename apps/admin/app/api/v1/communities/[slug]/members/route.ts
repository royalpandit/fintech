import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  getGroupBySlug,
  hasRole,
  ADMIN_ROLES,
  MOD_ROLES,
} from "@/lib/community";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(req);
    const userId = auth?.userId ?? null;
    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");

    const where: Record<string, unknown> = { groupId: group.id };
    if (role) where.role = role;

    const members = await prisma.groupMember.findMany({
      where,
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      include: {
        user: { select: { id: true, fullName: true, uuid: true, role: true } },
      },
    });

    return ok({
      members: members.map((m) => ({
        user_id: m.userId,
        role: m.role,
        joined_at: m.joinedAt.toISOString(),
        user: m.user,
        is_me: userId === m.userId,
      })),
    });
  } catch (e) {
    console.error("[GET /communities/:slug/members]", e);
    return err(e instanceof Error ? e.message : "Failed to load members", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const actor = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
    });
    if (!hasRole(actor?.role, ADMIN_ROLES)) return err("Forbidden", 403);

    const body = await parseBody<{
      userId?: number;
      role?: "admin" | "moderator" | "member";
      action?: "ban" | "remove";
      reason?: string;
    }>(req);

    if (!body.userId) return err("userId is required");
    if (body.userId === auth.userId) return err("Cannot modify yourself");

    const target = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: body.userId } },
    });

    if (body.action === "ban") {
      if (target?.role === "owner") return err("Cannot ban owner", 403);
      await prisma.$transaction([
        prisma.groupBan.upsert({
          where: { groupId_userId: { groupId: group.id, userId: body.userId } },
          create: {
            groupId: group.id,
            userId: body.userId,
            bannedBy: auth.userId,
            reason: body.reason ?? null,
          },
          update: { reason: body.reason ?? null, bannedBy: auth.userId },
        }),
        prisma.groupMember.deleteMany({
          where: { groupId: group.id, userId: body.userId },
        }),
      ]);
      return ok({ status: "banned" });
    }

    if (body.action === "remove") {
      if (target?.role === "owner") return err("Cannot remove owner", 403);
      if (!hasRole(actor?.role, ["owner"]) && target && hasRole(target.role, ADMIN_ROLES)) {
        return err("Only owner can remove admins", 403);
      }
      await prisma.groupMember.deleteMany({
        where: { groupId: group.id, userId: body.userId },
      });
      return ok({ status: "removed" });
    }

    if (body.role && ["admin", "moderator", "member"].includes(body.role)) {
      if (!hasRole(actor?.role, ["owner"])) return err("Only owner can assign roles", 403);
      if (target?.role === "owner") return err("Cannot change owner role", 403);
      await prisma.groupMember.update({
        where: { groupId_userId: { groupId: group.id, userId: body.userId } },
        data: { role: body.role },
      });
      return ok({ status: "role_updated", role: body.role });
    }

    return err("Invalid action");
  } catch (e) {
    console.error("[PATCH /communities/:slug/members]", e);
    return err(e instanceof Error ? e.message : "Failed to update member", 500);
  }
}
