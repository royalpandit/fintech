import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const portfolio = await prisma.portfolio.findFirst({
    where: { userId, deletedAt: null },
  });

  if (!portfolio) return ok({ points: [] });

  const snapshots = await prisma.portfolioSnapshotDaily.findMany({
    where: { portfolioId: portfolio.id },
    orderBy: { day: "asc" },
    take: 90,
  });

  const points = snapshots.map((s) => ({
    date: s.day,
    value: Number(s.totalValue),
    riskScore: Number(s.riskScore),
  }));

  return ok({ points });
}
