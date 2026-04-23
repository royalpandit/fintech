import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const advisorUserId = auth.userId;
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [wallet, dailyMetrics, payouts, subsAggByStatus] = await Promise.all([
    prisma.advisorWallet.findUnique({ where: { advisorUserId } }),
    prisma.advisorMetricDaily.findMany({
      where: { advisorUserId, day: { gte: ninetyDaysAgo } },
      orderBy: { day: "asc" },
    }),
    prisma.payoutRequest.findMany({
      where: { advisorUserId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.subscription.groupBy({
      by: ["status"],
      where: { advisorUserId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const totalLifetimeEarnings = dailyMetrics.reduce(
    (sum, m) => sum + Number(m.earningsAmount || 0),
    0,
  );

  return ok({
    wallet: {
      balance: wallet?.balance ? Number(wallet.balance) : 0,
      updatedAt: wallet?.updatedAt ?? null,
    },
    dailyMetrics,
    payouts,
    subscriptionSummary: subsAggByStatus.reduce<Record<string, { count: number; total: number }>>(
      (acc, row) => {
        acc[row.status] = {
          count: row._count._all,
          total: Number(row._sum.amount ?? 0),
        };
        return acc;
      },
      {},
    ),
    totalLifetimeEarnings,
  });
}
