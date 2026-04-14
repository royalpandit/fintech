import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const currentUserId = auth.userId;

  const targetUserId = Number(params.userId);

  await prisma.userFollow.deleteMany({
    where: {
      followerUserId: currentUserId,
      followingUserId: targetUserId,
    },
  });

  return ok({ unfollowed: targetUserId });
}
