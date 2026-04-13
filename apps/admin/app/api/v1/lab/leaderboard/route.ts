import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const latestPeriod = await prisma.leaderboardPeriod.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!latestPeriod) return ok({ data: [] });

  const entries = await prisma.leaderboardEntry.findMany({
    where: { periodId: latestPeriod.id },
    orderBy: { rankPos: "asc" },
    take: 50,
    include: {
      user: { select: { id: true, fullName: true, uuid: true } },
    },
  });

  const data = entries.map((e) => ({
    rank: e.rankPos,
    user: e.user,
    roi_pct: Number(e.roiPct),
  }));

  return ok({ data, period: latestPeriod.key });
}
