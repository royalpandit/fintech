import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { serializeSocialPost, socialPostInclude } from "@/lib/social-feed-serialize";
import type { FeedPostType, FeedSentiment } from "@/lib/social-feed-types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

function extractHashtags(content: string): string[] {
  const tags = content.match(/#[\w]+/g) ?? [];
  return [...new Set(tags.map(t => t.slice(1).toLowerCase()))];
}

async function upsertTags(postId: number, tagNames: string[]) {
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name, category: "hashtag" },
      update: { postCount: { increment: 1 } },
    });
    await prisma.communityPostTag.upsert({
      where: { postId_tagId: { postId, tagId: tag.id } },
      create: { postId, tagId: tag.id },
      update: {},
    });
  }
}

async function enrichPosts(userId: number | null, posts: Parameters<typeof serializeSocialPost>[0][]) {
  const ids = posts.map(p => p.id);
  const [likes, saves] = userId
    ? await Promise.all([
        prisma.communityReaction.findMany({
          where: { userId, postId: { in: ids }, type: "like" },
          select: { postId: true },
        }),
        prisma.communityPostSave.findMany({
          where: { userId, postId: { in: ids } },
          select: { postId: true },
        }),
      ])
    : [[], []];
  const likedIds = new Set(likes.map(l => l.postId));
  const savedIds = new Set(saves.map(s => s.postId));
  return posts.map(p => serializeSocialPost(p, { userId, likedIds, savedIds }));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth?.userId ?? null;
    const { searchParams } = new URL(req.url);
    const cursor = Number(searchParams.get("cursor") || 0) || undefined;
    const limit = Math.min(30, Math.max(1, Number(searchParams.get("limit") || PAGE_SIZE)));

    const rows = await prisma.communityPost.findMany({
      where: { deletedAt: null, visibility: "public" },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: socialPostInclude,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    const posts = await enrichPosts(userId, page);

    return ok({ posts, next_cursor: nextCursor });
  } catch (e) {
    console.error("[GET /community/posts]", e);
    return err(e instanceof Error ? e.message : "Failed to load posts", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth) return err("Unauthorized", 401);

    const body = await parseBody<{
      content?: string;
      postType?: FeedPostType;
      title?: string;
      sentiment?: FeedSentiment;
      targetPrice?: number;
      stopLossPrice?: number;
      thumbnailUrl?: string;
      articleBody?: string;
      imageUrls?: string[];
      videoUrls?: string[];
      symbols?: {
        symbol: string;
        tradingSymbol?: string;
        exchange?: string;
        token?: string;
      }[];
      mediaUrl?: string;
      category?: string;
    }>(req);

    const content = (body.content ?? "").trim();
    const isArticle = body.postType === "article";
    if (!content && !isArticle) return err("content is required");
    if (isArticle && !body.title?.trim()) return err("title is required for articles");

    let postType: FeedPostType = body.postType ?? "text";
    if (body.imageUrls?.length) postType = postType === "text" ? "image" : postType;
    if (body.videoUrls?.length) postType = "video";
    if (body.symbols?.length) postType = postType === "text" ? "chart" : postType;
    if (body.targetPrice || body.stopLossPrice) postType = "idea";

    const post = await prisma.communityPost.create({
      data: {
        userId: auth.userId,
        content: content || body.title || "",
        postType,
        title: body.title,
        sentiment: body.sentiment,
        targetPrice: body.targetPrice,
        stopLossPrice: body.stopLossPrice,
        thumbnailUrl: body.thumbnailUrl,
        articleBody: body.articleBody,
        mediaUrl: body.mediaUrl,
        category: body.category ?? "general",
        images: body.imageUrls?.length
          ? {
              create: body.imageUrls.map((url, i) => ({ url, sortOrder: i })),
            }
          : undefined,
        videos: body.videoUrls?.length
          ? {
              create: body.videoUrls.map((url, i) => ({ url, sortOrder: i })),
            }
          : undefined,
        symbols: body.symbols?.length
          ? {
              create: body.symbols.map((s, i) => ({
                symbol: s.symbol.toUpperCase(),
                tradingSymbol: s.tradingSymbol,
                exchange: s.exchange ?? "NSE",
                token: s.token,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: socialPostInclude,
    });

    const tags = extractHashtags(content);
    if (tags.length) await upsertTags(post.id, tags);

    const serialized = serializeSocialPost(post, {
      userId: auth.userId,
      likedIds: new Set(),
      savedIds: new Set(),
    });

    return ok({ post: serialized });
  } catch (e) {
    console.error("[POST /community/posts]", e);
    return err(e instanceof Error ? e.message : "Failed to create post", 500);
  }
}
