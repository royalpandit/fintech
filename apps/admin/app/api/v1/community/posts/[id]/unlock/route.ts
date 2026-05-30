import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { serializeSocialPost, socialPostInclude } from "@/lib/social-feed-serialize";

export const dynamic = "force-dynamic";

/**
 * Dev/test unlock — no payment gateway.
 * Future: replace dev_bypass with payment confirmation before unlock.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Sign in to unlock premium posts", 401);

  const postId = Number(params.id);
  const post = await prisma.communityPost.findFirst({
    where: { id: postId, deletedAt: null },
    include: socialPostInclude,
  });
  if (!post) return err("Post not found", 404);
  if (post.postAccessType !== "paid") return err("This post is not premium", 400);
  if (post.userId === auth.userId) {
    return ok({
      post: serializeSocialPost(post, {
        userId: auth.userId,
        unlockedIds: new Set([postId]),
      }),
    });
  }

  await prisma.communityPostUnlock.upsert({
    where: { postId_userId: { postId, userId: auth.userId } },
    create: {
      postId,
      userId: auth.userId,
      paymentStatus: "dev_bypass",
      unlockPrice: post.unlockPrice,
    },
    update: { paymentStatus: "dev_bypass", unlockedAt: new Date() },
  });

  return ok({
    post: serializeSocialPost(post, {
      userId: auth.userId,
      unlockedIds: new Set([postId]),
    }),
  });
}
