import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth, requireRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const body = await parseBody<{
    symbol?: string;
    name?: string;
    quantity?: number;
    avgPrice?: number;
    currentPrice?: number;
    sector?: string;
    assetType?: string;
  }>(req);

  if (!body.symbol || !body.quantity || !body.avgPrice) {
    return err("symbol, quantity, avgPrice are required");
  }

  let portfolio = await prisma.portfolio.findFirst({
    where: { userId, source: "manual", deletedAt: null },
  });

  if (!portfolio) {
    portfolio = await prisma.portfolio.create({
      data: { userId, source: "manual", name: "Manual Portfolio" },
    });
  }

  const costValue = body.quantity * body.avgPrice;
  const marketValue = body.quantity * (body.currentPrice || body.avgPrice);

  const asset = await prisma.portfolioAsset.upsert({
    where: {
      portfolioId_symbol: {
        portfolioId: portfolio.id,
        symbol: body.symbol.toUpperCase(),
      },
    },
    update: {
      quantity: body.quantity,
      avgPrice: body.avgPrice,
      currentPrice: body.currentPrice || body.avgPrice,
      costValue,
      marketValue,
    },
    create: {
      portfolioId: portfolio.id,
      symbol: body.symbol.toUpperCase(),
      name: body.name,
      assetType: (body.assetType as any) || "equity",
      sector: body.sector,
      quantity: body.quantity,
      avgPrice: body.avgPrice,
      currentPrice: body.currentPrice || body.avgPrice,
      costValue,
      marketValue,
    },
  });

  return ok({ asset });
}
