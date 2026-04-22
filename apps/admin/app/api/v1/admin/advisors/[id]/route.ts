import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(req, ["admin", "super_admin"]);
  if (!auth) return err("Forbidden", 403);

  const userId = Number(params.id);
  if (!Number.isFinite(userId) || userId <= 0) return err("Invalid advisor id");

  const advisor = await prisma.user.findFirst({
    where: { id: userId, role: "advisor" },
    select: {
      id: true,
      uuid: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      advisorProfile: {
        select: {
          sebiRegistrationNo: true,
          experienceYears: true,
          bio: true,
          expertiseTags: true,
          profileImageUrl: true,
          verificationStatus: true,
          verifiedAt: true,
          rejectionReason: true,
          verifiedBy: { select: { fullName: true } },
        },
      },
      kycDocuments: {
        select: {
          id: true,
          documentType: true,
          verificationStatus: true,
          verifiedAt: true,
        },
      },
    },
  });

  if (!advisor) return err("Advisor not found", 404);

  const [postStats, subscriberCount, latestMetrics] = await Promise.all([
    prisma.marketPost.groupBy({
      by: ["complianceStatus"],
      where: { advisorUserId: userId },
      _count: { _all: true },
    }),
    prisma.subscription.count({
      where: { advisorUserId: userId, status: "active" },
    }),
    prisma.advisorMetricDaily.findFirst({
      where: { advisorUserId: userId },
      orderBy: { day: "desc" },
    }),
  ]);

  return ok({
    advisor,
    stats: {
      posts: postStats.reduce<Record<string, number>>((acc, row) => {
        acc[row.complianceStatus] = row._count._all;
        return acc;
      }, {}),
      activeSubscribers: subscriberCount,
      latestMetrics,
    },
  });
}
