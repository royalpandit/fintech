import { prisma } from "@/lib/prisma";

// "Finuer score" — a reputation benchmark earned through real activity on the
// platform. Used to gate how much virtual (paper) balance a user can hold.
//
// Paper wallets are free up to FREE_BALANCE_CAP. To top up beyond that, a user
// must reach UNLOCK_SCORE by posting and interacting — this keeps the leaderboard
// meaningful and rewards engaged members.

export const FREE_BALANCE_CAP = 5_00_000; // ₹5 lakh — no score required
export const MAX_BALANCE_CAP = 10_000_000; // ₹1 crore — hard ceiling
export const UNLOCK_SCORE = 100; // Finuer score needed to top up beyond the free cap

// Points awarded per activity (the higher-effort the action, the more it counts).
const WEIGHTS = {
  post: 15,
  comment: 5,
  share: 3,
  like: 2,
  follow: 1,
};

export type FinuerScore = {
  score: number;
  unlocked: boolean;
  posts: number;
  comments: number;
  likes: number;
  shares: number;
  follows: number;
  reputationPoints: number;
  breakdown: { label: string; count: number; points: number }[];
};

export async function computeFinuerScore(userId: number): Promise<FinuerScore> {
  const [posts, comments, likes, shares, follows, repAgg] = await Promise.all([
    prisma.communityPost.count({ where: { userId, deletedAt: null } }),
    prisma.communityComment.count({ where: { userId, deletedAt: null } }),
    prisma.communityReaction.count({ where: { userId } }),
    prisma.communityPostShare.count({ where: { userId } }),
    prisma.userFollow.count({ where: { followerUserId: userId } }),
    prisma.reputationLog.aggregate({ _sum: { points: true }, where: { userId } }),
  ]);

  const reputationPoints = repAgg._sum.points ?? 0;

  const breakdown = [
    { label: "Posts", count: posts, points: posts * WEIGHTS.post },
    { label: "Comments", count: comments, points: comments * WEIGHTS.comment },
    { label: "Likes given", count: likes, points: likes * WEIGHTS.like },
    { label: "Shares", count: shares, points: shares * WEIGHTS.share },
    { label: "Following", count: follows, points: follows * WEIGHTS.follow },
  ];

  const score =
    breakdown.reduce((sum, b) => sum + b.points, 0) + reputationPoints;

  return {
    score,
    unlocked: score >= UNLOCK_SCORE,
    posts,
    comments,
    likes,
    shares,
    follows,
    reputationPoints,
    breakdown,
  };
}
