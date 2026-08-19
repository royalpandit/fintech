import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";
import { notifyNewFollower } from "@/lib/notify";

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const currentUserId = auth.userId;

  const targetUserId = Number(params.userId);
  if (currentUserId === targetUserId) return err("Cannot follow yourself");

  const existing = await prisma.userFollow.findUnique({
    where: {
      followerUserId_followingUserId: {
        followerUserId: currentUserId,
        followingUserId: targetUserId,
      },
    },
    select: { followerUserId: true },
  });

  await prisma.userFollow.upsert({
    where: {
      followerUserId_followingUserId: {
        followerUserId: currentUserId,
        followingUserId: targetUserId,
      },
    },
    update: {},
    create: {
      followerUserId: currentUserId,
      followingUserId: targetUserId,
    },
  });

  // Only notify on a genuinely new follow, so re-clicking doesn't spam.
  if (!existing) {
    const follower = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { fullName: true },
    });
    await notifyNewFollower({
      targetUserId,
      followerUserId: currentUserId,
      followerName: follower?.fullName ?? "Someone",
    });
  }

  return ok({ following: targetUserId });
}
