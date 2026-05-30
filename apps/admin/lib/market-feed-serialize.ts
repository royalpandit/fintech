import { isPostLocked, previewText } from "@/lib/post-access";

type MarketPostRow = {
  id: number;
  advisorUserId: number;
  content: string;
  postAccessType?: string;
  unlockPrice?: unknown;
  publishedAt: Date | null;
  createdAt: Date;
  [key: string]: unknown;
};

export type SerializedMarketFeedPost<T extends MarketPostRow> = T & {
  publishedAt: string | null;
  createdAt: string;
  post_access_type: "free" | "paid";
  unlock_price: number | null;
  is_unlocked: boolean;
  is_locked: boolean;
  content: string;
};

export function serializeMarketFeedPost<T extends MarketPostRow>(
  p: T,
  opts: { userId: number | null; unlockedPostIds: Set<number> },
): SerializedMarketFeedPost<T> {
  const postAccessType = (p.postAccessType ?? "free") as "free" | "paid";
  const isOwn = opts.userId != null && p.advisorUserId === opts.userId;
  const isUnlocked = isOwn || opts.unlockedPostIds.has(p.id);
  const locked = isPostLocked({ postAccessType, isUnlocked, isOwn });

  return {
    ...p,
    publishedAt: p.publishedAt instanceof Date ? p.publishedAt.toISOString() : null,
    createdAt:
      p.createdAt instanceof Date ? p.createdAt.toISOString() : (p.createdAt as string),
    post_access_type: postAccessType,
    unlock_price: p.unlockPrice != null ? Number(p.unlockPrice) : null,
    is_unlocked: isUnlocked,
    is_locked: locked,
    content: locked ? previewText(String(p.content)) : p.content,
  };
}

export function serializeMarketFeedPosts(
  posts: MarketPostRow[],
  userId: number | null,
  unlockedPostIds: number[],
) {
  const unlockedSet = new Set(unlockedPostIds);
  return posts.map((p) => serializeMarketFeedPost(p, { userId, unlockedPostIds: unlockedSet }));
}
