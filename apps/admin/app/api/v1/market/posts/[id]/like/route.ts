import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";
import { notifyPostLike } from "@/lib/notify";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const postId = Number(params.id);

  const existing = await prisma.marketReaction.findFirst({
    where: { postId, userId, type: "like" },
  });

  if (existing) {
    await prisma.marketReaction.delete({ where: { id: existing.id } });
    return ok({ post_id: postId, liked: false });
  }

  await prisma.marketReaction.create({
    data: { postId, userId, type: "like" },
  });

  // Only on the like, not the unlike above.
  const [post, liker] = await Promise.all([
    prisma.marketPost.findUnique({
      where: { id: postId },
      select: { advisorUserId: true, title: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
  ]);
  if (post) {
    await notifyPostLike({
      postId,
      postTitle: post.title,
      authorUserId: post.advisorUserId,
      likerUserId: userId,
      likerName: liker?.fullName ?? "Someone",
    });
  }

  return ok({ post_id: postId, liked: true });
}
