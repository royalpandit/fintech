import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { getMutualFunds } from "@/lib/amfi";
import { isMutualFundSymbol } from "@/lib/instrument-type";
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

  /*
   * Mark fund holdings to the published NAV.
   *
   * lastPricesFromTrades falls back to the price a position was bought at, so
   * without this a mutual fund would sit at its purchase NAV for ever and show
   * exactly zero unrealised P&L no matter how the fund performed. Equities get
   * a live quote pushed in through ?quotes= by the client; funds have no such
   * feed, and the AMFI list is already cached for six hours, so reading it here
   * costs nothing after the first call.
   */
  const fundCodes = [...new Set(trades.map((t) => t.symbol).filter(isMutualFundSymbol))];
  if (fundCodes.length) {
    try {
      const funds = await getMutualFunds();
      const navByCode = new Map(funds.map((f) => [f.code, f.nav]));
      for (const code of fundCodes) {
        const nav = navByCode.get(code);
        if (nav != null && nav > 0) priceBySymbol[code.toUpperCase()] = nav;
      }
    } catch {
      // AMFI unreachable — fall through to the purchase price rather than
      // failing the whole summary over one holding.
    }
  }

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
