import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  getGroupBySlug,
  hasRole,
  ADMIN_ROLES,
  notifyUser,
} from "@/lib/community";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; userId: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const adminMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
    });
    if (!hasRole(adminMember?.role, ADMIN_ROLES)) return err("Forbidden", 403);

    const targetUserId = Number(params.userId);
    const body = await parseBody<{ action?: "approve" | "reject" }>(req);
    if (body.action !== "approve" && body.action !== "reject") {
      return err("action must be 'approve' or 'reject'");
    }

    const joinReq = await prisma.groupJoinRequest.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: targetUserId } },
    });
    if (!joinReq || joinReq.status !== "pending") {
      return err("No pending request found", 404);
    }

    if (body.action === "approve") {
      await prisma.$transaction([
        prisma.groupJoinRequest.update({
          where: { id: joinReq.id },
          data: {
            status: "approved",
            reviewedBy: auth.userId,
            reviewedAt: new Date(),
          },
        }),
        prisma.groupMember.upsert({
          where: { groupId_userId: { groupId: group.id, userId: targetUserId } },
          create: { groupId: group.id, userId: targetUserId, role: "member" },
          update: {},
        }),
      ]);
      await notifyUser(
        targetUserId,
        "Join request approved",
        `Your request to join ${group.name} was approved.`,
        { type: "join_approved", groupId: group.id, slug: group.slug },
      );
      return ok({ status: "approved" });
    }

    await prisma.groupJoinRequest.update({
      where: { id: joinReq.id },
      data: {
        status: "rejected",
        reviewedBy: auth.userId,
        reviewedAt: new Date(),
      },
    });
    await notifyUser(
      targetUserId,
      "Join request rejected",
      `Your request to join ${group.name} was rejected.`,
      { type: "join_rejected", groupId: group.id, slug: group.slug },
    );
    return ok({ status: "rejected" });
  } catch (e) {
    console.error("[POST /communities/:slug/requests/:userId]", e);
    return err(e instanceof Error ? e.message : "Failed to process request", 500);
  }
}
