import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { getGroupBySlug, hasRole, ADMIN_ROLES } from "@/lib/community";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
    });
    if (!hasRole(member?.role, ADMIN_ROLES)) return err("Forbidden", 403);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "pending";

    const requests = await prisma.groupJoinRequest.findMany({
      where: {
        groupId: group.id,
        status: status as "pending" | "approved" | "rejected",
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true, uuid: true, email: true } },
      },
    });

    return ok({
      requests: requests.map((r) => ({
        id: r.id,
        status: r.status,
        message: r.message,
        created_at: r.createdAt.toISOString(),
        reviewed_at: r.reviewedAt?.toISOString() ?? null,
        user: r.user,
      })),
    });
  } catch (e) {
    console.error("[GET /communities/:slug/requests]", e);
    return err(e instanceof Error ? e.message : "Failed to load requests", 500);
  }
}
