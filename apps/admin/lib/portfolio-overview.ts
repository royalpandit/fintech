import "server-only";

import { prisma } from "@/lib/prisma";
import {
  computePortfolioSummary,
  computePositions,
  lastPricesFromTrades,
  type VirtualPosition,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";
import { resolveToken } from "@/lib/paper-market-quote";
import { getOHLC } from "@/lib/dhan";
import { getYahooQuotes } from "@/lib/yahoo-quote";
import { getMutualFunds } from "@/lib/amfi";
import { isMutualFundSymbol } from "@/lib/instrument-type";
import { sectorForSymbol } from "@/lib/market-sectors";

/**
 * The portfolio, priced at the market.
 *
 * Everything on /user/portfolio used to come from one of two places, and both
 * were wrong:
 *
 *   - Total value, day change, risk and diversification read the `portfolios`
 *     row, which is only written by a broker sync. With no broker connected it
 *     is all zeroes, so the page showed a ₹0 portfolio above a positions table
 *     containing real holdings.
 *   - The positions table itself priced every holding with
 *     lastPricesFromTrades — the price it was BOUGHT at. LTP therefore always
 *     equalled average cost and unrealised P&L was exactly ₹0, permanently, no
 *     matter what the market did.
 *
 * This prices the paper book properly and derives the headline numbers, the
 * sector split and the holdings list from it, so the whole page describes one
 * consistent portfolio.
 */

export type PricedPosition = VirtualPosition & {
  /** Previous close, when the feed gave us one — needed for day change. */
  previousClose: number | null;
  dayChange: number;
  sector: string;
  weightPct: number;
};

export type PortfolioOverview = {
  positions: PricedPosition[];
  cashBalance: number;
  investedCost: number;
  holdingsValue: number;
  totalEquity: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  realizedPnL: number;
  totalPnL: number;
  totalPnLPct: number;
  /** Sum of per-holding day change; null when no holding reported a close. */
  dayChange: number | null;
  dayChangePct: number | null;
  sectors: { sector: string; value: number; pct: number }[];
  /** True when at least one price came from somewhere other than the feed. */
  degraded: boolean;
};

const INITIAL_BALANCE = 1_000_000;

type Quote = { price: number; previousClose: number | null };

/**
 * Live prices for a set of symbols, in as few round trips as possible.
 *
 * Equities go out as ONE batched Dhan quote request rather than one per symbol:
 * every Dhan call is serialised behind an 850 ms global gap, so a five-holding
 * portfolio priced one symbol at a time would take four seconds before the page
 * could render. Funds are priced from the AMFI NAV list, which is already
 * cached whole.
 */
async function priceSymbols(symbols: string[]): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  if (!symbols.length) return out;

  const funds = symbols.filter(isMutualFundSymbol);
  const equities = symbols.filter((s) => !isMutualFundSymbol(s));

  if (funds.length) {
    try {
      const all = await getMutualFunds();
      const navByCode = new Map(all.map((f) => [f.code, f.nav]));
      for (const code of funds) {
        const nav = navByCode.get(code);
        // A fund has one NAV a day, so there is no meaningful intraday change.
        if (nav != null && nav > 0) out.set(code, { price: nav, previousClose: null });
      }
    } catch {
      /* leave them unpriced; the caller falls back to cost */
    }
  }

  if (equities.length) {
    const resolved: { symbol: string; token: string; exchange: string }[] = [];
    for (const symbol of equities) {
      try {
        const hit = await resolveToken(symbol, "NSE");
        if (hit) resolved.push({ symbol, token: hit.token, exchange: hit.exchange });
      } catch {
        /* unresolvable symbol - Yahoo gets a try below */
      }
    }

    if (resolved.length) {
      try {
        const rows = await getOHLC(
          resolved.map((r) => ({ exchange: r.exchange, symboltoken: r.token })),
        );
        const byToken = new Map(rows.map((r) => [String(r.symbolToken), r]));
        for (const r of resolved) {
          const q = byToken.get(r.token);
          const ltp = Number(q?.ltp);
          if (Number.isFinite(ltp) && ltp > 0) {
            const close = Number(q?.close);
            out.set(r.symbol, {
              price: ltp,
              previousClose: Number.isFinite(close) && close > 0 ? close : null,
            });
          }
        }
      } catch {
        /* rate limited or token expired - Yahoo below */
      }
    }

    // Whatever the feed could not price, try the standby source.
    const missing = equities.filter((s) => !out.has(s));
    if (missing.length) {
      try {
        const rows = await getYahooQuotes(
          missing.map((s) => ({ exchange: "NSE", symboltoken: s, tradingSymbol: s })),
        );
        for (const r of rows) {
          const ltp = Number(r.ltp);
          if (Number.isFinite(ltp) && ltp > 0) {
            out.set(r.tradingSymbol.toUpperCase(), {
              price: ltp,
              previousClose: Number(r.close) > 0 ? Number(r.close) : null,
            });
          }
        }
      } catch {
        /* nothing more to try */
      }
    }
  }

  return out;
}

/*
 * Short per-user cache.
 *
 * This is called from the app shell, which renders on every /user/* page, as
 * well as from the portfolio page and the dashboard — so a single navigation
 * to /user/portfolio would otherwise assemble and re-price the whole book
 * twice, and every hop between Feed and Markets would fire another batched
 * quote request for a number in the sidebar.
 *
 * Fifteen seconds is longer than any single render and shorter than the
 * three-second market poll is meaningful over, so the sidebar figure stays
 * honest while costing at most one quote request per quarter-minute.
 */
const OVERVIEW_TTL_MS = 15_000;
const overviewCache = new Map<number, { value: PortfolioOverview | null; at: number }>();

/** Drop a user's cached overview — call after a fill changes the book. */
export function invalidatePortfolioOverview(userId: number): void {
  overviewCache.delete(userId);
}

/** Null when the user has no paper wallet at all. */
export async function loadPortfolioOverview(
  userId: number,
): Promise<PortfolioOverview | null> {
  const hit = overviewCache.get(userId);
  if (hit && Date.now() - hit.at < OVERVIEW_TTL_MS) return hit.value;

  const value = await buildPortfolioOverview(userId);
  overviewCache.set(userId, { value, at: Date.now() });
  return value;
}

async function buildPortfolioOverview(
  userId: number,
): Promise<PortfolioOverview | null> {
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

  // Which symbols are actually still held — no point pricing a closed position.
  const held = computePositions(trades, lastPricesFromTrades(trades));
  const quotes = await priceSymbols(held.map((p) => p.symbol));

  // Cost basis stays the fallback: a holding we could not price shows flat
  // rather than crashing the totals or showing a zero market value.
  const prices: Record<string, number> = { ...lastPricesFromTrades(trades) };
  for (const p of held) {
    const q = quotes.get(p.symbol);
    if (q) prices[p.symbol] = q.price;
  }

  const positions = computePositions(trades, prices);
  const summary = computePortfolioSummary(
    Number(wallet.balance),
    trades,
    prices,
    INITIAL_BALANCE,
  );

  const holdingsValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const weight = (v: number) => (holdingsValue > 0 ? (v / holdingsValue) * 100 : 0);

  let dayChange = 0;
  let anyClose = false;
  let openingValue = 0;

  const priced: PricedPosition[] = positions.map((p) => {
    const q = quotes.get(p.symbol);
    const prev = q?.previousClose ?? null;
    const change = prev != null ? (p.lastPrice - prev) * p.quantity : 0;
    if (prev != null) {
      anyClose = true;
      dayChange += change;
      openingValue += prev * p.quantity;
    }
    return {
      ...p,
      previousClose: prev,
      dayChange: change,
      // ETFs and fund codes are not in the curated sector list; grouping them
      // under a real sector would be a guess, so they get their own bucket.
      sector: sectorForSymbol(p.symbol) ?? "Other",
      weightPct: weight(p.marketValue),
    };
  });

  const bySector = new Map<string, number>();
  for (const p of priced) {
    bySector.set(p.sector, (bySector.get(p.sector) ?? 0) + p.marketValue);
  }

  return {
    positions: priced,
    cashBalance: summary.cashBalance,
    investedCost: summary.investedCost,
    holdingsValue: summary.holdingsValue,
    totalEquity: summary.totalEquity,
    unrealizedPnL: summary.unrealizedPnL,
    unrealizedPnLPct:
      summary.investedCost > 0 ? (summary.unrealizedPnL / summary.investedCost) * 100 : 0,
    realizedPnL: summary.realizedPnL,
    totalPnL: summary.totalPnL,
    totalPnLPct: summary.totalPnLPct,
    dayChange: anyClose ? dayChange : null,
    dayChangePct: anyClose && openingValue > 0 ? (dayChange / openingValue) * 100 : null,
    sectors: [...bySector.entries()]
      .map(([sector, value]) => ({ sector, value, pct: weight(value) }))
      .sort((a, b) => b.value - a.value),
    degraded: priced.some((p) => !quotes.has(p.symbol)),
  };
}
