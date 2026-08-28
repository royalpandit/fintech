import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  enrichSocialPosts,
  serializeSocialPost,
  socialPostInclude,
} from "@/lib/social-feed-serialize";
import { parsePostAccessType } from "@/lib/post-access";
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


export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth?.userId ?? null;
    const { searchParams } = new URL(req.url);
    const cursor = Number(searchParams.get("cursor") || 0) || undefined;
    const limit = Math.min(30, Math.max(1, Number(searchParams.get("limit") || PAGE_SIZE)));
    const q = (searchParams.get("q") || "").trim();

    const rows = await prisma.communityPost.findMany({
      where: {
        deletedAt: null,
        visibility: "public",
        // Search by keyword — content (catches inline #tags and $symbols),
        // title, and any attached symbol chip.
        ...(q
          ? {
              OR: [
                { content: { contains: q, mode: "insensitive" as const } },
                { title: { contains: q, mode: "insensitive" as const } },
                { symbols: { some: { symbol: { contains: q.toUpperCase() } } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: socialPostInclude,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;
    const posts = await enrichSocialPosts(userId, page);

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
      entryPrice?: number;
      cmp?: number;
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
      postAccessType?: string;
      unlockPrice?: number;
    }>(req);

    const postAccessType = parsePostAccessType(body.postAccessType) ?? "free";
    if (body.postAccessType != null && !parsePostAccessType(body.postAccessType)) {
      return err("postAccessType must be 'free' or 'paid'");
    }

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
        postAccessType,
        unlockPrice:
          postAccessType === "paid" && typeof body.unlockPrice === "number"
            ? body.unlockPrice
            : null,
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

    // Notify any @mentioned users (best-effort; matches on first name so an
    // advisor tagged like "@Ananya" gets an in-app notification).
    try {
      const tokens = [
        ...new Set(
          [...content.matchAll(/@([a-zA-Z][a-zA-Z0-9_]{1,30})/g)].map((m) => m[1].toLowerCase()),
        ),
      ];
      if (tokens.length) {
        const candidates = await prisma.user.findMany({
          where: {
            id: { not: auth.userId },
            deletedAt: null,
            OR: tokens.map((t) => ({ fullName: { startsWith: t, mode: "insensitive" as const } })),
          },
          select: { id: true, fullName: true },
          take: 20,
        });
        const mentioned = candidates.filter((u) =>
          tokens.includes(u.fullName.trim().split(/\s+/)[0]?.toLowerCase() ?? ""),
        );
        if (mentioned.length) {
          const author = await prisma.user.findUnique({
            where: { id: auth.userId },
            select: { fullName: true },
          });
          await prisma.notification.createMany({
            data: mentioned.map((u) => ({
              userId: u.id,
              title: "You were mentioned",
              message: `${author?.fullName ?? "Someone"} mentioned you in a post.`,
              channel: "in_app" as const,
              data: { type: "mention", postId: post.id, byUserId: auth.userId },
            })),
          });
        }
      }
    } catch (e) {
      console.error("[community/posts] mention notify failed", e);
    }

    const serialized = serializeSocialPost(post, {
      userId: auth.userId,
      likedIds: new Set(),
      savedIds: new Set(),
      unlockedIds: new Set(),
    });

    return ok({ post: serialized });
  } catch (e) {
    console.error("[POST /community/posts]", e);
    return err(e instanceof Error ? e.message : "Failed to create post", 500);
  }
}
