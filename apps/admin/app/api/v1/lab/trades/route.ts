import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  attachRealizedPnL,
  filterTradesByPeriod,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const side = searchParams.get("side");
  const month = searchParams.get("month") ?? undefined;
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 200)));

  const wallet = await prisma.virtualWallet.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });
  if (!wallet) return ok({ trades: [], summary: null });

  const rows = await prisma.tradeVirtual.findMany({
    where: {
      walletId: wallet.id,
      ...(symbol ? { symbol } : {}),
      ...(side === "buy" || side === "sell" ? { side } : {}),
    },
    orderBy: { tradedAt: "desc" },
    take: limit,
  });

  let trades: VirtualTradeRow[] = rows.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "buy" | "sell",
    quantity: Number(t.quantity),
    price: Number(t.price),
    tradedAt: t.tradedAt,
  }));

  trades = filterTradesByPeriod(trades, {
    month,
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr + "T23:59:59") : undefined,
  });

  const withPnL = attachRealizedPnL(
    trades.map((t) => ({ ...t, id: t.id as number })),
  ).reverse();

  return ok({
    trades: withPnL.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
      value: t.value,
      realized_pnl: t.realizedPnL,
      traded_at: t.tradedAt.toISOString(),
    })),
  });
}
