import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { serializeSocialPost, socialPostInclude } from "@/lib/social-feed-serialize";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const postId = Number(params.id);
  const existing = await prisma.communityPost.findFirst({
    where: { id: postId, userId: auth.userId, deletedAt: null },
  });
  if (!existing) return err("Post not found", 404);

  const body = await parseBody<{
    content?: string;
    title?: string;
    sentiment?: "bullish" | "bearish" | "neutral";
    targetPrice?: number;
    stopLossPrice?: number;
    entryPrice?: number;
    cmp?: number;
    articleBody?: string;
  }>(req);

  const post = await prisma.communityPost.update({
    where: { id: postId },
    data: {
      content: body.content,
      title: body.title,
      sentiment: body.sentiment,
      entryPrice: body.entryPrice,
      cmp: body.cmp,
      targetPrice: body.targetPrice,
      stopLossPrice: body.stopLossPrice,
      articleBody: body.articleBody,
    },
    include: socialPostInclude,
  });

  return ok({
    post: serializeSocialPost(post, {
      userId: auth.userId,
      likedIds: new Set(),
      savedIds: new Set(),
    }),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(_req);
  if (!auth) return err("Unauthorized", 401);

  const postId = Number(params.id);
  const existing = await prisma.communityPost.findFirst({
    where: { id: postId, userId: auth.userId, deletedAt: null },
  });
  if (!existing) return err("Post not found", 404);

  await prisma.communityPost.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });

  return ok({ deleted: true });
}
