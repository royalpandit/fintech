import { isPostLocked, previewText } from "@/lib/post-access";
import { potentialReturnPct, tradeSide } from "@/lib/trades";

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

export type SerializedMarketFeedPost<T extends MarketPostRow> = Omit<
  T,
  "targetPrice" | "stopLossPrice" | "entryPriceMin" | "entryPriceMax"
> & {
  publishedAt: string | null;
  createdAt: string;
  post_access_type: "free" | "paid";
  unlock_price: number | null;
  is_unlocked: boolean;
  is_locked: boolean;
  content: string;
  // Trades Phase 1/2 — Prisma Decimals coerced to plain numbers for the client.
  // For LOCKED posts the raw prices are withheld (null) but the upside % and
  // whether-it's-a-trade are still exposed so the card can show a teaser.
  targetPrice: number | null;
  stopLossPrice: number | null;
  entryPriceMin: number | null;
  entryPriceMax: number | null;
  potential_return_pct: number | null;
  has_trade: boolean;
};

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function serializeMarketFeedPost<T extends MarketPostRow>(
  p: T,
  opts: { userId: number | null; unlockedPostIds: Set<number> },
): SerializedMarketFeedPost<T> {
  const postAccessType = (p.postAccessType ?? "free") as "free" | "paid";
  const isOwn = opts.userId != null && p.advisorUserId === opts.userId;
  const isUnlocked = isOwn || opts.unlockedPostIds.has(p.id);
  const locked = isPostLocked({ postAccessType, isUnlocked, isOwn });

  const entryMin = toNum(p.entryPriceMin);
  const entryMax = toNum(p.entryPriceMax);
  const target = toNum(p.targetPrice);
  const stopLoss = toNum(p.stopLossPrice);
  const hasTrade = entryMin != null || entryMax != null || target != null || stopLoss != null;
  const returnPct = potentialReturnPct({
    entryMin,
    entryMax,
    target,
    side: tradeSide(p.sentiment as string | null | undefined),
  });

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
    // Withhold the actual numbers for locked posts — only the upside % leaks out.
    targetPrice: locked ? null : target,
    stopLossPrice: locked ? null : stopLoss,
    entryPriceMin: locked ? null : entryMin,
    entryPriceMax: locked ? null : entryMax,
    potential_return_pct: returnPct,
    has_trade: hasTrade,
  } as SerializedMarketFeedPost<T>;
}

export function serializeMarketFeedPosts(
  posts: MarketPostRow[],
  userId: number | null,
  unlockedPostIds: number[],
) {
  const unlockedSet = new Set(unlockedPostIds);
  return posts.map((p) => serializeMarketFeedPost(p, { userId, unlockedPostIds: unlockedSet }));
}
