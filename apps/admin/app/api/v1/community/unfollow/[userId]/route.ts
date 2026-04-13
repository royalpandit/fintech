import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const currentUserId = Number(req.headers.get("x-user-id"));
  if (!currentUserId) return err("Unauthorized", 401);

  const targetUserId = Number(params.userId);

  await prisma.userFollow.deleteMany({
    where: {
      followerUserId: currentUserId,
      followingUserId: targetUserId,
    },
  });

  return ok({ unfollowed: targetUserId });
}
