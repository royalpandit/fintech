import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { marketPostAudienceWhere } from "@/lib/post-visibility";
import { serializeMarketFeedPost } from "@/lib/market-feed-serialize";
import { enrichSocialPosts, socialPostInclude } from "@/lib/social-feed-serialize";
import type { SocialPost } from "@/lib/social-feed-types";

/** The advisor row shape this module selects, derived from `advisorInclude`
 *  below so the two can't drift. */
type AdvisorRow = Prisma.MarketPostGetPayload<{ include: typeof advisorInclude }>;
type CommunityRow = Prisma.CommunityPostGetPayload<{ include: typeof socialPostInclude }>;
type SerializedAdvisorPost = ReturnType<typeof serializeMarketFeedPost<AdvisorRow>>;

/**
 * The unified feed — one Instagram-style stream instead of the old For You /
 * Community / Advisors tabs.
 *
 * Two different things are being interleaved:
 *   - `marketPost`  — advisor analysis (the old "For You" and "Advisors" tabs,
 *                     which were the same query split by follow status)
 *   - `communityPost` — user social posts (the old "Community" tab)
 *
 * Ranking is follow-first, then recency, in two phases:
 *   phase "followed"  → everything authored by someone you follow
 *   phase "discover"  → everything else
 * The reader walks `followed` to exhaustion, then rolls into `discover`. That
 * gives "people you follow first, then others" without needing a global score.
 *
 * ── On the cursor ──────────────────────────────────────────────────────────
 * Two tables can't share one id cursor, so the cursor is `<phase>:<ISO time>`
 * and each source is queried for rows at or before that instant. The bound is
 * inclusive (`lte`) rather than exclusive, because two posts can share a
 * timestamp and an exclusive bound would silently drop one of them. That means
 * the boundary row can repeat, so callers MUST dedupe on `key` when appending —
 * `feedItemKey()` exists for exactly that.
 */

export type UnifiedFeedItem =
  | {
      kind: "advisor";
      /** `${kind}:${id}` — stable across pages, for React keys and dedupe. */
      key: string;
      /** Sort instant, ISO. publishedAt for advisor posts. */
      at: string;
      /** True when the author is someone the viewer follows. */
      followed: boolean;
      post: SerializedAdvisorPost;
    }
  | {
      kind: "community";
      key: string;
      at: string;
      followed: boolean;
      post: SocialPost;
    };

export type FeedPhase = "followed" | "discover";

export type UnifiedFeedPage = {
  items: UnifiedFeedItem[];
  /** null when the whole stream (both phases) is exhausted. */
  nextCursor: string | null;
};

export type UnifiedFeedSource = "all" | "following" | "discover";
export type UnifiedFeedKind = "advisor" | "community";

export type UnifiedFeedOptions = {
  userId: number | null;
  limit?: number;
  cursor?: string | null;
  /** Which half of the stream to read. "all" walks followed then discover. */
  source?: UnifiedFeedSource;
  /** Which post types to include. Empty or both = everything. */
  kinds?: UnifiedFeedKind[];
  /** Free-text search across post text, symbol, and author name. */
  q?: string;
};

export function feedItemKey(item: UnifiedFeedItem): string {
  return item.key;
}

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 30;

function parseCursor(cursor: string | null | undefined): { phase: FeedPhase; before: Date | null } {
  if (!cursor) return { phase: "followed", before: null };
  const idx = cursor.indexOf(":");
  if (idx === -1) return { phase: "followed", before: null };
  const phase = cursor.slice(0, idx) === "discover" ? "discover" : "followed";
  const raw = cursor.slice(idx + 1);
  const d = raw ? new Date(raw) : null;
  return { phase, before: d && !Number.isNaN(d.getTime()) ? d : null };
}

function makeCursor(phase: FeedPhase, at: string): string {
  return `${phase}:${at}`;
}

/** Advisor posts with a structured entry/target/SL live in /user/trades. */
const NOT_A_TRADE = { entryPriceMin: null, targetPrice: null, stopLossPrice: null } as const;

const advisorInclude = {
  advisor: {
    select: {
      id: true,
      fullName: true,
      advisorProfile: {
        select: {
          sebiRegistrationNo: true,
          profileImageUrl: true,
          professionalType: true,
        },
      },
    },
  },
  _count: { select: { reactions: true, comments: true } },
} as const;

/** Who the viewer follows, and who they've blocked in either direction. */
export async function getFeedAudience(userId: number | null): Promise<{
  followedIds: number[];
  blockedIds: number[];
}> {
  if (!userId) return { followedIds: [], blockedIds: [] };

  const [follows, blocks] = await Promise.all([
    prisma.userFollow.findMany({
      where: { followerUserId: userId },
      select: { followingUserId: true },
    }),
    // UserBlock may not be migrated in every environment — treat as no blocks.
    prisma.userBlock
      .findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      })
      .catch(() => [] as { blockerId: number; blockedId: number }[]),
  ]);

  return {
    followedIds: follows.map((f) => f.followingUserId),
    blockedIds: blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)),
  };
}

/**
 * One page of the merged stream.
 *
 * Each source is over-fetched by `limit` so that after merging and slicing we
 * still have a full page — otherwise a burst of community posts would starve
 * the advisor side of the page (and vice versa).
 */
export async function fetchUnifiedFeed(opts: UnifiedFeedOptions): Promise<UnifiedFeedPage> {
  const { userId } = opts;
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT));
  const source = opts.source ?? "all";
  const kinds = opts.kinds && opts.kinds.length > 0 ? opts.kinds : (["advisor", "community"] as const);
  const wantAdvisor = kinds.includes("advisor");
  const wantCommunity = kinds.includes("community");
  const q = (opts.q ?? "").trim();

  const { followedIds, blockedIds } = await getFeedAudience(userId);

  // "following" with nobody followed can never return anything; skip straight
  // to an empty page rather than running two queries that match everyone.
  const hasFollows = followedIds.length > 0;

  const parsed = parseCursor(opts.cursor);
  let phase: FeedPhase = parsed.phase;
  if (source === "discover") phase = "discover";
  if (source === "following") phase = "followed";
  if (phase === "followed" && !hasFollows && source === "all") phase = "discover";

  const page = await readPhase({
    phase,
    before: parsed.before,
    limit,
    userId,
    followedIds,
    blockedIds,
    wantAdvisor,
    wantCommunity,
    q,
  });

  // Followed ran dry and the caller wants the whole stream — roll into discover
  // within the same request, so the reader never sees a blank page mid-scroll.
  if (page.items.length === 0 && phase === "followed" && source === "all") {
    const next = await readPhase({
      phase: "discover",
      before: null,
      limit,
      userId,
      followedIds,
      blockedIds,
      wantAdvisor,
      wantCommunity,
      q,
    });
    return next;
  }

  return page;
}

async function readPhase(args: {
  phase: FeedPhase;
  before: Date | null;
  limit: number;
  userId: number | null;
  followedIds: number[];
  blockedIds: number[];
  wantAdvisor: boolean;
  wantCommunity: boolean;
  q: string;
}): Promise<UnifiedFeedPage> {
  const { phase, before, limit, userId, followedIds, blockedIds, wantAdvisor, wantCommunity, q } =
    args;
  const followed = phase === "followed";

  // In the followed phase we restrict to the follow list; in discover we
  // exclude it (plus anyone blocked), so the two phases never overlap.
  const authorScope = followed
    ? { in: followedIds.filter((id) => !blockedIds.includes(id)) }
    : blockedIds.length > 0 || followedIds.length > 0
      ? { notIn: [...new Set([...followedIds, ...blockedIds])] }
      : undefined;

  if (followed && followedIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  const audienceWhere = await marketPostAudienceWhere(userId);
  const take = limit + 1;

  const advisorSearch = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { content: { contains: q, mode: "insensitive" as const } },
          { marketSymbol: { contains: q.toUpperCase() } },
          { advisor: { fullName: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const communitySearch = q
    ? {
        OR: [
          { content: { contains: q, mode: "insensitive" as const } },
          { title: { contains: q, mode: "insensitive" as const } },
          { symbols: { some: { symbol: { contains: q.toUpperCase() } } } },
          { user: { fullName: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [advisorRows, communityRows] = await Promise.all([
    wantAdvisor
      ? prisma.marketPost.findMany({
          where: {
            complianceStatus: "approved",
            deletedAt: null,
            publishedAt: before ? { not: null, lte: before } : { not: null },
            ...NOT_A_TRADE,
            ...(authorScope ? { advisorUserId: authorScope } : {}),
            ...audienceWhere,
            ...advisorSearch,
          },
          orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          take,
          include: advisorInclude,
        })
      : Promise.resolve([] as AdvisorRow[]),

    wantCommunity
      ? prisma.communityPost.findMany({
          where: {
            deletedAt: null,
            visibility: "public",
            ...(before ? { createdAt: { lte: before } } : {}),
            ...(authorScope ? { userId: authorScope } : {}),
            ...communitySearch,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take,
          include: socialPostInclude,
        })
      : Promise.resolve([] as CommunityRow[]),
  ]);

  const unlockedPostIds =
    userId && advisorRows.length > 0
      ? new Set(
          (
            await prisma.marketPostUnlock.findMany({
              where: { userId, postId: { in: advisorRows.map((r) => r.id) } },
              select: { postId: true },
            })
          ).map((u) => u.postId),
        )
      : new Set<number>();

  const serializedCommunity = await enrichSocialPosts(userId, communityRows);

  const merged: UnifiedFeedItem[] = [
    ...advisorRows.map((row) => {
      const at = (row.publishedAt ?? row.createdAt).toISOString();
      return {
        kind: "advisor" as const,
        key: `advisor:${row.id}`,
        at,
        followed,
        post: serializeMarketFeedPost(row, { userId, unlockedPostIds }),
      };
    }),
    ...serializedCommunity.map((post) => ({
      kind: "community" as const,
      key: `community:${post.id}`,
      at: post.created_at,
      followed,
      post,
    })),
  ];

  merged.sort((a, b) => {
    const d = Date.parse(b.at) - Date.parse(a.at);
    // Stable tie-break so identical timestamps don't reshuffle between pages.
    return d !== 0 ? d : b.key.localeCompare(a.key);
  });

  const items = merged.slice(0, limit);

  // More to read in this phase only if a source actually had an extra row AND
  // the page filled up; otherwise this phase is done.
  const sourceHasMore = advisorRows.length > limit || communityRows.length > limit;
  const last = items[items.length - 1];

  if (sourceHasMore && last) {
    return { items, nextCursor: makeCursor(phase, last.at) };
  }

  // Phase exhausted. From "followed" the reader continues into "discover";
  // from "discover" the stream is over.
  return {
    items,
    nextCursor: phase === "followed" ? makeCursor("discover", new Date().toISOString()) : null,
  };
}
