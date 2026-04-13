import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const currentUserId = Number(req.headers.get("x-user-id"));
  if (!currentUserId) return err("Unauthorized", 401);

  const targetUserId = Number(params.userId);
  if (currentUserId === targetUserId) return err("Cannot follow yourself");

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

  return ok({ following: targetUserId });
}
