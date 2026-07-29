import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { marketPostAudienceWhere } from "@/lib/post-visibility";
import { serializeMarketFeedPosts } from "@/lib/market-feed-serialize";
import { publishDueScheduledPosts } from "@/lib/scheduled-posts";
import TradesClient from "@/components/trades/trades-client";

export const dynamic = "force-dynamic";

// Dedicated Trades section — structured BUY/SELL calls live here; normal analysis
// posts stay in the Feed. See TRADES-PHASE1-2-CHANGES.md (Phase 3).
export default async function TradesPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  await publishDueScheduledPosts();

  const audienceWhere = await marketPostAudienceWhere(userId);

  const posts = await prisma.marketPost.findMany({
    where: {
      complianceStatus: "approved",
      deletedAt: null,
      // Drafts have publishedAt: null, so this also excludes them.
      publishedAt: { not: null },
      // Combine the "is a trade" OR with the audience OR under AND so neither
      // clobbers the other (both return an `OR` key).
      AND: [
        {
          OR: [
            { entryPriceMin: { not: null } },
            { targetPrice: { not: null } },
            { stopLossPrice: { not: null } },
          ],
        },
        audienceWhere,
      ],
    },
    orderBy: [{ boostedUntil: { sort: "desc", nulls: "last" } }, { publishedAt: "desc" }],
    take: 40,
    include: {
      advisor: {
        select: {
          id: true,
          fullName: true,
          advisorProfile: { select: { sebiRegistrationNo: true, profileImageUrl: true } },
        },
      },
      _count: { select: { reactions: true, comments: true } },
    },
  });

  const unlocked = userId
    ? (
        await prisma.marketPostUnlock.findMany({
          where: { userId, postId: { in: posts.map((p) => p.id) } },
          select: { postId: true },
        })
      ).map((u) => u.postId)
    : [];

  if (userId) {
    // Advisors the viewer actively subscribes to — at the advisor level (legacy
    // `subscription`) or via any of their subscription services. Their paid trades
    // are already paid for, so unlock them (no "Unlock" button).
    const [advisorSubs, serviceSubs] = await Promise.all([
      prisma.subscription.findMany({
        where: { userId, status: "active" },
        select: { advisorUserId: true },
      }),
      prisma.serviceSubscription.findMany({
        where: { userId, status: "active", OR: [{ endDate: null }, { endDate: { gt: new Date() } }] },
        select: { advisorUserId: true },
      }),
    ]);
    const subscribedAdvisorIds = new Set<number>([
      ...advisorSubs.map((s) => s.advisorUserId),
      ...serviceSubs.map((s) => s.advisorUserId),
    ]);

    for (const p of posts) {
      // Unlock when: it reached them via a non-public (subscribers/custom) audience
      // — the audience filter already proved eligibility — OR they subscribe to the
      // trade's advisor. Only truly PUBLIC paid trades from non-subscribed advisors
      // still need a per-post unlock.
      const hasAccess = p.audience !== "public" || subscribedAdvisorIds.has(p.advisorUserId);
      if (hasAccess && !unlocked.includes(p.id)) unlocked.push(p.id);
    }
  }

  const serialized = serializeMarketFeedPosts(posts, userId, unlocked);

  // ── Advisor promotion rail ────────────────────────────────────────────────
  // "Featured Analysts" are advisors who paid to be promoted (featuredUntil in
  // the future). When there aren't enough, we backfill the rail with the most
  // active analysts by trade count so it never looks empty. Billing for the
  // paid slot is BYPASSED for now (dev) — see /api/v1/advisor/feature.
  const now = new Date();

  const tradeCountRows = await prisma.marketPost.groupBy({
    by: ["advisorUserId"],
    where: { complianceStatus: "approved", deletedAt: null, publishedAt: { not: null } },
    _count: { _all: true },
  });
  const tradeCount = new Map<number, number>(
    tradeCountRows.map((r) => [r.advisorUserId, r._count._all]),
  );

  const advisorSelect = {
    userId: true,
    profileImageUrl: true,
    expertiseTags: true,
    user: { select: { id: true, fullName: true } },
  } as const;

  const featuredRows = await prisma.advisorProfile.findMany({
    where: { featuredUntil: { gt: now } },
    orderBy: { featuredUntil: "desc" },
    take: 6,
    select: advisorSelect,
  });
  const featuredIds = new Set(featuredRows.map((r) => r.userId));

  const topIds = [...tradeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .filter((id) => !featuredIds.has(id))
    .slice(0, 5);
  const topRows = topIds.length
    ? await prisma.advisorProfile.findMany({
        where: { userId: { in: topIds } },
        select: advisorSelect,
      })
    : [];

  type AdvisorRow = (typeof featuredRows)[number];
  const toAdvisorCard = (r: AdvisorRow, sponsored: boolean) => ({
    id: r.user.id,
    fullName: r.user.fullName,
    image: r.profileImageUrl,
    expertise: r.expertiseTags.slice(0, 2),
    tradeCount: tradeCount.get(r.userId) ?? 0,
    sponsored,
  });

  const topById = new Map(topRows.map((r) => [r.userId, r]));
  const featuredAdvisors = featuredRows.map((r) => toAdvisorCard(r, true));
  const topAdvisors = topIds
    .map((id) => topById.get(id))
    .filter((r): r is AdvisorRow => Boolean(r))
    .map((r) => toAdvisorCard(r, false));

  return (
    <TradesClient
      trades={JSON.parse(JSON.stringify(serialized))}
      isAuthed={isAuthed}
      featuredAdvisors={featuredAdvisors}
      topAdvisors={topAdvisors}
    />
  );
}
