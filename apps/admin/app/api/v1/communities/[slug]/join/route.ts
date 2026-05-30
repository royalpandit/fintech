import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  getGroupBySlug,
  getMembership,
  isBanned,
  notifyGroupAdmins,
  notifyUser,
  serializeCommunity,
  communityInclude,
} from "@/lib/community";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    if (await isBanned(group.id, auth.userId)) {
      return err("You are banned from this community", 403);
    }

    const existing = await getMembership(group.id, auth.userId);
    if (existing) return ok({ status: "member" });

    if (group.communityType === "public") {
      await prisma.groupMember.create({
        data: { groupId: group.id, userId: auth.userId, role: "member" },
      });
      const updated = await prisma.group.findUniqueOrThrow({
        where: { id: group.id },
        include: communityInclude,
      });
      return ok({
        status: "joined",
        community: await serializeCommunity(updated, auth.userId),
      });
    }

    const pending = await prisma.groupJoinRequest.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
    });
    if (pending?.status === "pending") return ok({ status: "pending" });
    if (pending?.status === "rejected") {
      await prisma.groupJoinRequest.update({
        where: { id: pending.id },
        data: { status: "pending", reviewedBy: null, reviewedAt: null },
      });
    } else {
      await prisma.groupJoinRequest.create({
        data: { groupId: group.id, userId: auth.userId, status: "pending" },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true },
    });
    await notifyGroupAdmins(
      group.id,
      "New join request",
      `${user?.fullName ?? "Someone"} requested to join ${group.name}.`,
      { type: "join_request", groupId: group.id, userId: auth.userId },
    );

    return ok({ status: "pending" });
  } catch (e) {
    console.error("[POST /communities/:slug/join]", e);
    return err(e instanceof Error ? e.message : "Failed to join", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const group = await getGroupBySlug(params.slug);
    if (!group) return err("Community not found", 404);

    const member = await getMembership(group.id, auth.userId);
    if (!member) return ok({ status: "not_member" });
    if (member.role === "owner") return err("Owner cannot leave. Transfer ownership or delete community.", 400);

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
    });

    return ok({ status: "left" });
  } catch (e) {
    console.error("[DELETE /communities/:slug/join]", e);
    return err(e instanceof Error ? e.message : "Failed to leave", 500);
  }
}
