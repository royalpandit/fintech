import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  computePositions,
  lastPricesFromTrades,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const wallet = await prisma.virtualWallet.findUnique({
    where: { userId },
    include: {
      trades: { orderBy: { tradedAt: "asc" } },
    },
  });

  if (!wallet) return ok({ data: [] });

  const trades: VirtualTradeRow[] = wallet.trades.map((t) => ({
    symbol: t.symbol,
    side: t.side as "buy" | "sell",
    quantity: Number(t.quantity),
    price: Number(t.price),
    tradedAt: t.tradedAt,
  }));

  const data = computePositions(trades, lastPricesFromTrades(trades));
  return ok({ data });
}
