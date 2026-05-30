import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { notifyUser } from "@/lib/community";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const postId = Number(params.id);
  const post = await prisma.communityPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true, userId: true, groupId: true, title: true },
  });
  if (!post) return err("Post not found", 404);

  const existing = await prisma.communityReaction.findFirst({
    where: { postId, userId: auth.userId, type: "like" },
  });

  if (existing) {
    await prisma.communityReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.communityReaction.create({
      data: { postId, userId: auth.userId, type: "like" },
    });
    if (post.userId !== auth.userId) {
      const liker = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { fullName: true },
      });
      await notifyUser(
        post.userId,
        "New like",
        `${liker?.fullName ?? "Someone"} liked your post.`,
        { type: "post_like", postId, groupId: post.groupId },
      );
    }
  }

  const count = await prisma.communityReaction.count({ where: { postId, type: "like" } });
  return ok({ liked: !existing, count });
}
