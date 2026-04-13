import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const portfolio = await prisma.portfolio.findFirst({
    where: { userId, deletedAt: null },
    include: { assets: true },
  });

  if (!portfolio) {
    return ok({
      risk_score: 0,
      diversification_score: 0,
      suggested_rebalance: [],
      sector_exposure: [],
    });
  }

  const sectors: Record<string, number> = {};
  portfolio.assets.forEach((a) => {
    const sector = a.sector || "Unknown";
    sectors[sector] = (sectors[sector] || 0) + Number(a.marketValue);
  });

  const sectorExposure = Object.entries(sectors).map(([sector, value]) => ({
    sector,
    value,
    percentage:
      Number(portfolio.totalValue) > 0
        ? (value / Number(portfolio.totalValue)) * 100
        : 0,
  }));

  const suggestions: string[] = [];
  const topSector = sectorExposure.sort((a, b) => b.percentage - a.percentage)[0];
  if (topSector && topSector.percentage > 40) {
    suggestions.push(`Reduce ${topSector.sector} concentration (${topSector.percentage.toFixed(1)}%)`);
  }
  suggestions.push("Increase debt/gold allocation for better diversification");

  return ok({
    risk_score: Number(portfolio.riskScore),
    diversification_score: Number(portfolio.diversificationScore),
    suggested_rebalance: suggestions,
    sector_exposure: sectorExposure,
  });
}
