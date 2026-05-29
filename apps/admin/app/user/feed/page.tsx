import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import FeedClient from "@/components/feed/FeedClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function UserFeedPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  const currentUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
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

  // Exclude blocked + followed from discover
  const notInDiscoverIds = [...new Set([...followedIds, ...blockedIds])];

  const postSelect = {
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
  } as const;

  const orderBy = [
    { publishedAt: { sort: "desc" as const, nulls: "last" as const } },
    { createdAt: "desc" as const },
  ];

  const [followedPosts, discoverPostsRaw, suggestedAdvisors, trendingSymbols] =
    await Promise.all([
      followedIds.length > 0
        ? prisma.marketPost.findMany({
            where: {
              complianceStatus: "approved",
              deletedAt: null,
              advisorUserId: { in: followedIds, notIn: blockedIds },
            },
            orderBy,
            take: 20,
            ...postSelect,
          })
        : Promise.resolve([]),

      prisma.marketPost.findMany({
        where: {
          complianceStatus: "approved",
          deletedAt: null,
          ...(notInDiscoverIds.length > 0 ? { advisorUserId: { notIn: notInDiscoverIds } } : {}),
        },
        orderBy,
        take: PAGE_SIZE + 1,
        ...postSelect,
      }),

      prisma.advisorProfile.findMany({
        where: {
          verificationStatus: "approved",
          ...(followedIds.length > 0 ? { userId: { notIn: followedIds } } : {}),
          ...(blockedIds.length > 0 ? { userId: { notIn: blockedIds } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          user: {
            select: { id: true, fullName: true, _count: { select: { followers: true } } },
          },
        },
      }),

      prisma.marketPost.groupBy({
        by: ["marketSymbol"],
        where: {
          complianceStatus: "approved",
          deletedAt: null,
          marketSymbol: { not: null },
          publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 6,
      }),
    ]);

  // Pagination: discover posts
  const hasMore = discoverPostsRaw.length > PAGE_SIZE;
  const discoverPosts = hasMore ? discoverPostsRaw.slice(0, PAGE_SIZE) : discoverPostsRaw;
  const nextCursor = hasMore ? discoverPosts[discoverPosts.length - 1].id : null;

  // Which visible posts has the user liked?
  const allVisibleIds = [...followedPosts, ...discoverPosts].map((p) => p.id);
  const likedPostIds: number[] =
    userId && allVisibleIds.length > 0
      ? (
          await prisma.marketReaction.findMany({
            where: { userId, postId: { in: allVisibleIds }, type: "like" },
            select: { postId: true },
          })
        ).map((r) => r.postId)
      : [];

  // Serialize dates to strings (plain objects for client component)
  function serializePost(p: (typeof discoverPosts)[number]) {
    return {
      ...p,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }

  return (
    <section>
      <FeedClient
        initialFollowedPosts={followedPosts.map(serializePost)}
        initialDiscoverPosts={discoverPosts.map(serializePost)}
        initialNextCursor={nextCursor}
        isAuthed={isAuthed}
        userId={userId}
        initialFollowedIds={followedIds}
        initialLikedPostIds={likedPostIds}
        currentUserName={currentUser?.fullName ?? null}
        suggestedAdvisors={suggestedAdvisors}
        trendingSymbols={trendingSymbols}
      />
    </section>
  );
}
