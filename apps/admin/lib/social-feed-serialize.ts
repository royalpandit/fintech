import type { SocialPost } from "./social-feed-types";
import { applyContentLock, isPostLocked, type PostAccessType } from "./post-access";

type DbPost = {
  id: number;
  uuid: string;
  content: string;
  postType: string;
  title: string | null;
  sentiment: string | null;
  entryPrice: unknown;
  cmp: unknown;
  targetPrice: unknown;
  stopLossPrice: unknown;
  thumbnailUrl: string | null;
  articleBody: string | null;
  postAccessType: string;
  unlockPrice: unknown;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  user: { id: number; fullName: string; uuid: string };
  images: { id: number; url: string; sortOrder: number }[];
  videos: { id: number; url: string; sortOrder: number }[];
  symbols: {
    id: number;
    symbol: string;
    tradingSymbol: string | null;
    exchange: string | null;
    token: string | null;
  }[];
  _count: { comments: number; reactions: number; saves: number };
};

export function serializeSocialPost(
  post: DbPost,
  opts: {
    userId?: number | null;
    likedIds?: Set<number>;
    savedIds?: Set<number>;
    unlockedIds?: Set<number>;
  },
): SocialPost {
  const postAccessType = (post.postAccessType ?? "free") as PostAccessType;
  const isOwn = opts.userId != null && post.userId === opts.userId;
  const isUnlocked = isOwn || (opts.unlockedIds?.has(post.id) ?? false);
  const locked = isPostLocked({ postAccessType, isUnlocked, isOwn });

  const base: SocialPost = {
    id: post.id,
    uuid: post.uuid,
    content: post.content,
    post_type: post.postType as SocialPost["post_type"],
    title: post.title,
    sentiment: post.sentiment as SocialPost["sentiment"],
    entry_price: post.entryPrice != null ? Number(post.entryPrice) : null,
    cmp: post.cmp != null ? Number(post.cmp) : null,
    target_price: post.targetPrice != null ? Number(post.targetPrice) : null,
    stop_loss_price: post.stopLossPrice != null ? Number(post.stopLossPrice) : null,
    thumbnail_url: post.thumbnailUrl,
    article_body: post.articleBody,
    created_at: post.createdAt.toISOString(),
    updated_at: post.updatedAt.toISOString(),
    user: post.user,
    images: post.images.map((i) => ({ id: i.id, url: i.url, sort_order: i.sortOrder })),
    videos: post.videos.map((v) => ({ id: v.id, url: v.url, sort_order: v.sortOrder })),
    symbols: post.symbols.map((s) => ({
      id: s.id,
      symbol: s.symbol,
      trading_symbol: s.tradingSymbol,
      exchange: s.exchange,
      token: s.token,
    })),
    like_count: post._count.reactions,
    comment_count: post._count.comments,
    save_count: post._count.saves,
    liked_by_me: opts.likedIds?.has(post.id) ?? false,
    saved_by_me: opts.savedIds?.has(post.id) ?? false,
    is_own: isOwn,
    post_access_type: postAccessType,
    unlock_price: post.unlockPrice != null ? Number(post.unlockPrice) : null,
    is_unlocked: isUnlocked,
    is_locked: locked,
  };

  return applyContentLock(base);
}

export const socialPostInclude = {
  user: { select: { id: true, fullName: true, uuid: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
  videos: { orderBy: { sortOrder: "asc" as const } },
  symbols: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { comments: true, reactions: true, saves: true } },
} as const;
