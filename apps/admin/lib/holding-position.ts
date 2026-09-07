import "server-only";

import { prisma } from "@/lib/prisma";
import {
  computePositions,
  lastPricesFromTrades,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";
import { fetchLiveLtp } from "@/lib/paper-market-quote";
import { getYahooQuotes } from "@/lib/yahoo-quote";
import { isMutualFundSymbol } from "@/lib/instrument-type";
import type { HoldingContext } from "@/lib/holding-insight";

/**
 * One holding, assembled the same way for the detail page and for the agent
 * API behind it.
 *
 * Both need identical numbers: the page shows them and the agents are told
 * them, and a page saying +8.3% next to an agent reasoning about +2.1% would
 * be worse than either alone. So the assembly lives here once.
 */

export type HoldingDetail = {
  context: HoldingContext;
  /** Every fill for this symbol, newest first. */
  trades: { id: number; side: string; quantity: number; price: number; tradedAt: Date }[];
  /** Where the current price came from, so the page can say. */
  priceSource: "live" | "delayed" | "last-trade";
};

/**
 * A live price, degrading rather than failing.
 *
 * Dhan first (the same path orders use). Yahoo second, which keeps the page
 * useful while the daily Dhan token is expired. Last resort is the price of
 * the user's own most recent fill — wrong as a market price, but it keeps the
 * position rendering instead of showing a zero.
 */
async function priceFor(
  symbol: string,
  fallback: number,
): Promise<{ price: number; source: HoldingDetail["priceSource"] }> {
  // Funds have no exchange quote; fetchLiveLtp routes them to the AMFI NAV.
  const exchange = isMutualFundSymbol(symbol) ? "MF" : "NSE";

  try {
    const ltp = await fetchLiveLtp({ symbol, exchange });
    if (ltp > 0) return { price: ltp, source: "live" };
  } catch {
    /* fall through */
  }

  if (exchange !== "MF") {
    try {
      const rows = await getYahooQuotes([
        { exchange: "NSE", symboltoken: symbol, tradingSymbol: symbol },
      ]);
      const ltp = Number(rows[0]?.ltp);
      if (Number.isFinite(ltp) && ltp > 0) return { price: ltp, source: "delayed" };
    } catch {
      /* fall through */
    }
  }

  return { price: fallback, source: "last-trade" };
}

/** Null when the user does not hold this symbol. */
export async function loadHolding(
  userId: number,
  rawSymbol: string,
): Promise<HoldingDetail | null> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return null;

  const wallet = await prisma.virtualWallet.findUnique({
    where: { userId },
    include: { trades: { orderBy: { tradedAt: "asc" } } },
  });
  if (!wallet) return null;

  const trades: VirtualTradeRow[] = wallet.trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "buy" | "sell",
    quantity: Number(t.quantity),
    price: Number(t.price),
    tradedAt: t.tradedAt,
  }));

  // Positions first, off last-traded prices, so we know whether the symbol is
  // even held before spending a network call on a quote.
  const withLastPrices = computePositions(trades, lastPricesFromTrades(trades));
  const position = withLastPrices.find((p) => p.symbol === symbol);
  if (!position || position.quantity <= 0) return null;

  const { price, source } = await priceFor(symbol, position.avgPrice);

  // Recompute every position at the refreshed price so the weight below is a
  // share of a consistently-valued portfolio.
  const prices = { ...lastPricesFromTrades(trades), [symbol]: price };
  const positions = computePositions(trades, prices);
  const me = positions.find((p) => p.symbol === symbol)!;

  const portfolioValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const weight = (v: number) => (portfolioValue > 0 ? (v / portfolioValue) * 100 : 0);

  const symbolTrades = trades.filter((t) => t.symbol.toUpperCase() === symbol);
  const firstBuy = symbolTrades.find((t) => t.side === "buy") ?? null;
  const heldDays = firstBuy
    ? Math.max(0, Math.floor((Date.now() - firstBuy.tradedAt.getTime()) / 86_400_000))
    : null;

  return {
    context: {
      symbol,
      quantity: me.quantity,
      avgPrice: me.avgPrice,
      lastPrice: me.lastPrice,
      marketValue: me.marketValue,
      unrealizedPnL: me.unrealizedPnL,
      unrealizedPnLPct: me.unrealizedPnLPct,
      weightPct: weight(me.marketValue),
      heldDays,
      firstBoughtAt: firstBuy?.tradedAt ?? null,
      otherHoldings: positions
        .filter((p) => p.symbol !== symbol)
        .map((p) => ({ symbol: p.symbol, weightPct: weight(p.marketValue) }))
        .sort((a, b) => b.weightPct - a.weightPct),
    },
    trades: symbolTrades
      .map((t) => ({
        id: t.id,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        tradedAt: t.tradedAt,
      }))
      .reverse(),
    priceSource: source,
  };
}
