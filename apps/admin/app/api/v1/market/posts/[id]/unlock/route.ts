import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { applyContentLock, isPostLocked, type PostAccessType } from "@/lib/post-access";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Sign in to unlock premium posts", 401);

  const postId = Number(params.id);
  const post = await prisma.marketPost.findFirst({
    where: { id: postId, deletedAt: null, complianceStatus: "approved" },
    include: {
      advisor: {
        select: {
          id: true,
          fullName: true,
          advisorProfile: { select: { sebiRegistrationNo: true } },
        },
      },
      _count: { select: { reactions: true, comments: true } },
    },
  });
  if (!post) return err("Post not found", 404);
  if (post.postAccessType !== "paid") return err("This post is not premium", 400);

  const isOwn = post.advisorUserId === auth.userId;
  if (!isOwn) {
    await prisma.marketPostUnlock.upsert({
      where: { postId_userId: { postId, userId: auth.userId } },
      create: {
        postId,
        userId: auth.userId,
        paymentStatus: "dev_bypass",
        unlockPrice: post.unlockPrice,
      },
      update: { paymentStatus: "dev_bypass", unlockedAt: new Date() },
    });
  }

  const postAccessType = post.postAccessType as PostAccessType;
  const payload = {
    id: post.id,
    title: post.title,
    content: post.content,
    marketSymbol: post.marketSymbol,
    assetType: post.assetType,
    riskLevel: post.riskLevel,
    sentiment: post.sentiment,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    advisor: post.advisor,
    _count: post._count,
    post_access_type: postAccessType,
    unlock_price: post.unlockPrice != null ? Number(post.unlockPrice) : null,
    is_unlocked: true,
    is_locked: false,
  };

  return ok({ post: applyContentLock(payload as Parameters<typeof applyContentLock>[0]) });
}
