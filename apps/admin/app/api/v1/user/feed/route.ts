import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  const userId = auth?.userId ?? null;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ? Number(searchParams.get("cursor")) : undefined;
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 10));

  // Blocked user IDs — requires UserBlock table (run: npx prisma db push)
  let blockedIds: number[] = [];
  if (userId) {
    try {
      const blocks = await (prisma as any).userBlock.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      });
      blockedIds = (blocks as { blockerId: number; blockedId: number }[]).map((b) =>
        b.blockerId === userId ? b.blockedId : b.blockerId
      );
    } catch {
      // Table not yet migrated — skip block filter
    }
  }

  // Followed advisor IDs — exclude from discover section
  const followedIds = userId
    ? (
        await prisma.userFollow.findMany({
          where: { followerUserId: userId },
          select: { followingUserId: true },
        })
      ).map((f) => f.followingUserId)
    : [];

  const notInIds = [...new Set([...followedIds, ...blockedIds])];

  const where = {
    complianceStatus: "approved" as const,
    deletedAt: null,
    ...(notInIds.length > 0 ? { advisorUserId: { notIn: notInIds } } : {}),
    ...(cursor ? { id: { lt: cursor } } : {}),
  };

  const posts = await prisma.marketPost.findMany({
    where,
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit + 1,
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
  });

  const hasMore = posts.length > limit;
  const data = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  // Which of these posts has the user already liked?
  let likedPostIds: number[] = [];
  if (userId && data.length > 0) {
    const reactions = await prisma.marketReaction.findMany({
      where: { userId, postId: { in: data.map((p) => p.id) }, type: "like" },
      select: { postId: true },
    });
    likedPostIds = reactions.map((r) => r.postId);
  }

  return ok({ data, nextCursor, likedPostIds });
}
