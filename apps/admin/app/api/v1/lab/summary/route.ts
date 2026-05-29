import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  computePortfolioSummary,
  computePositions,
  lastPricesFromTrades,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";

export const dynamic = "force-dynamic";

const INITIAL_BALANCE = 1_000_000;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const wallet = await prisma.virtualWallet.findUnique({
    where: { userId: auth.userId },
    include: { trades: { orderBy: { tradedAt: "asc" } } },
  });

  if (!wallet) {
    return ok({
      has_wallet: false,
      summary: null,
      positions: [],
    });
  }

  const trades: VirtualTradeRow[] = wallet.trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "buy" | "sell",
    quantity: Number(t.quantity),
    price: Number(t.price),
    tradedAt: t.tradedAt,
  }));

  let priceBySymbol = lastPricesFromTrades(trades);

  const quotesParam = new URL(req.url).searchParams.get("quotes");
  if (quotesParam) {
    try {
      const parsed = JSON.parse(quotesParam) as { symbol: string; ltp: number }[];
      for (const q of parsed) {
        if (q.symbol && q.ltp > 0) priceBySymbol[q.symbol.toUpperCase()] = q.ltp;
      }
    } catch {
      /* ignore */
    }
  }
  const cashBalance = Number(wallet.balance);
  const summary = computePortfolioSummary(cashBalance, trades, priceBySymbol, INITIAL_BALANCE);
  const positions = computePositions(trades, priceBySymbol);

  return ok({
    has_wallet: true,
    currency: wallet.currency,
    summary: {
      cash_balance: summary.cashBalance,
      invested_cost: summary.investedCost,
      holdings_value: summary.holdingsValue,
      total_equity: summary.totalEquity,
      realized_pnl: summary.realizedPnL,
      unrealized_pnl: summary.unrealizedPnL,
      total_pnl: summary.totalPnL,
      total_pnl_pct: summary.totalPnLPct,
      open_positions: summary.openPositions,
      total_trades: summary.totalTrades,
    },
    positions: positions.map((p) => ({
      symbol: p.symbol,
      quantity: p.quantity,
      avg_price: p.avgPrice,
      last_price: p.lastPrice,
      cost_basis: p.costBasis,
      market_value: p.marketValue,
      unrealized_pnl: p.unrealizedPnL,
      unrealized_pnl_pct: p.unrealizedPnLPct,
    })),
  });
}
