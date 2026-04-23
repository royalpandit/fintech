import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);
  const userId = auth.userId;

  const [flaggedPosts, rejectedPosts, toxicComments, pendingReview] = await Promise.all([
    prisma.marketPost.findMany({
      where: { advisorUserId: userId, complianceStatus: "flagged", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        complianceRiskScore: true,
        updatedAt: true,
      },
    }),
    prisma.marketPost.findMany({
      where: { advisorUserId: userId, complianceStatus: "rejected", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        complianceRiskScore: true,
        updatedAt: true,
      },
    }),
    prisma.marketComment.findMany({
      where: {
        deletedAt: null,
        post: { advisorUserId: userId, deletedAt: null },
        toxicityScore: { gte: 7 },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        content: true,
        toxicityScore: true,
        createdAt: true,
        post: { select: { id: true, title: true } },
        user: { select: { fullName: true } },
      },
    }),
    prisma.marketPost.count({
      where: {
        advisorUserId: userId,
        deletedAt: null,
        complianceStatus: { in: ["pending", "under_review"] },
      },
    }),
  ]);

  const totalAlerts = flaggedPosts.length + rejectedPosts.length + toxicComments.length;

  return ok({
    summary: {
      flaggedPosts: flaggedPosts.length,
      rejectedPosts: rejectedPosts.length,
      toxicComments: toxicComments.length,
      pendingReview,
      totalAlerts,
    },
    flaggedPosts,
    rejectedPosts,
    toxicComments,
  });
}
