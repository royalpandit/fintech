import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import FeedClient from "@/components/feed/FeedClient";
import { fetchUnifiedFeed } from "@/lib/unified-feed";
import { publishDueScheduledPosts } from "@/lib/scheduled-posts";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function UserFeedPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  // Publish any scheduled posts whose time has come before building the feed.
  await publishDueScheduledPosts();

  const currentUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          fullName: true,
          avatarUrl: true,
          advisorProfile: { select: { profileImageUrl: true } },
        },
      })
    : null;

  // Blocked advisor IDs — requires UserBlock table (run: npx prisma db push)
  let blockedIds: number[] = [];
  if (userId) {
    try {
      const blocks = await (prisma as any).userBlock.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      });
      blockedIds = (blocks as { blockerId: number; blockedId: number }[]).map((b) =>
        b.blockerId === userId ? b.blockedId : b.blockerId,
      );
    } catch {
      // Table not yet migrated — skip block filter
    }
  }

  // Followed advisor IDs
  const follows = userId
    ? await prisma.userFollow.findMany({
        where: { followerUserId: userId },
        select: { followingUserId: true },
      })
    : [];
  const followedIds = follows.map((f) => f.followingUserId);

  const now = new Date();
  const excludeIds = [...new Set([...followedIds, ...blockedIds])];
  /** Suggested-advisor slots. Paid placements fill these first. */
  const SUGGESTED_SLOTS = 3;
  const TRENDING_SLOTS = 3;

  const [feedPage, featuredRows, trendingPosts] = await Promise.all([
    // One merged, follow-first page — the same call /api/v1/feed serves, so the
    // server render and the infinite scroll can never disagree about ranking.
    fetchUnifiedFeed({ userId, limit: PAGE_SIZE }),

    // Sponsored suggestions: advisors with a live Featured placement, newest
    // purchase first. See lib/sponsorship.ts — this rail is the product they're
    // paying for, alongside the Trades rail.
    prisma.advisorProfile.findMany({
      where: {
        verificationStatus: "approved",
        featuredUntil: { gt: now },
        ...(excludeIds.length > 0 ? { userId: { notIn: excludeIds } } : {}),
      },
      orderBy: { featuredUntil: "desc" },
      take: SUGGESTED_SLOTS,
      include: {
        user: {
          select: { id: true, fullName: true, _count: { select: { followers: true } } },
        },
      },
    }),

    // Trending posts — most engaged in the last 7 days.
    prisma.marketPost.findMany({
      where: {
        complianceStatus: "approved",
        deletedAt: null,
        publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: [{ reactions: { _count: "desc" } }, { comments: { _count: "desc" } }],
      take: TRENDING_SLOTS,
      select: {
        id: true,
        title: true,
        marketSymbol: true,
        advisor: { select: { fullName: true } },
        _count: { select: { reactions: true, comments: true } },
      },
    }),
  ]);

  // Backfill any slot no advisor has paid for, so the rail is never empty and
  // discovery still works before sponsorship has any take-up. Only the paid
  // rows carry the "Sponsored" label.
  const featuredIds = featuredRows.map((r) => r.userId);
  const backfillRows =
    featuredRows.length < SUGGESTED_SLOTS
      ? await prisma.advisorProfile.findMany({
          where: {
            verificationStatus: "approved",
            userId: { notIn: [...excludeIds, ...featuredIds] },
          },
          orderBy: { createdAt: "desc" },
          take: SUGGESTED_SLOTS - featuredRows.length,
          include: {
            user: {
              select: { id: true, fullName: true, _count: { select: { followers: true } } },
            },
          },
        })
      : [];

  const suggestedAdvisors = [
    ...featuredRows.map((r) => ({
      userId: r.userId,
      profileImageUrl: r.profileImageUrl,
      user: r.user,
      sponsored: true,
    })),
    ...backfillRows.map((r) => ({
      userId: r.userId,
      profileImageUrl: r.profileImageUrl,
      user: r.user,
      sponsored: false,
    })),
  ];

  // Likes for the advisor posts on this first page.
  const advisorIds = feedPage.items
    .filter((i) => i.kind === "advisor")
    .map((i) => i.post.id);
  const likedPostIds: number[] =
    userId && advisorIds.length > 0
      ? (
          await prisma.marketReaction.findMany({
            where: { userId, postId: { in: advisorIds }, type: "like" },
            select: { postId: true },
          })
        ).map((r) => r.postId)
      : [];

  return (
    <section>
      <FeedClient
        initialItems={feedPage.items}
        initialNextCursor={feedPage.nextCursor}
        isAuthed={isAuthed}
        userId={userId}
        initialFollowedIds={followedIds}
        initialLikedPostIds={likedPostIds}
        currentUserName={currentUser?.fullName ?? null}
        currentUserAvatar={
          currentUser?.advisorProfile?.profileImageUrl ?? currentUser?.avatarUrl ?? null
        }
        suggestedAdvisors={suggestedAdvisors}
        trendingPosts={trendingPosts}
      />
    </section>
  );
}
