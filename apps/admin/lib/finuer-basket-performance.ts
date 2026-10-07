import type { FinuerBasketStock, FinuerBenchmark } from "@prisma/client";
import { getYahooCandles } from "@/lib/yahoo-quote";
import type { Candle } from "@/lib/angelone-types";
import { computePerformanceStatus, toNumber } from "@/lib/finuer-basket";
import { prisma } from "@/lib/prisma";

type StockRow = Pick<
  FinuerBasketStock,
  "symbol" | "stockName" | "exchange" | "weightPct" | "cmp" | "entryPrice"
>;

const PERIOD_DAYS = {
  oneMonth: 30,
  threeMonth: 90,
  sixMonth: 180,
  oneYear: 365,
  threeYear: 365 * 3,
  fiveYear: 365 * 5,
} as const;

const BENCHMARK_INDEX: Record<string, { symbol: string; exchange: string }> = {
  "nifty 50":   { symbol: "NIFTY",     exchange: "IDX_I" },
  "nifty50":    { symbol: "NIFTY",     exchange: "IDX_I" },
  "nifty bank": { symbol: "BANKNIFTY", exchange: "IDX_I" },
  "bank nifty": { symbol: "BANKNIFTY", exchange: "IDX_I" },
  "sensex":     { symbol: "SENSEX",    exchange: "IDX_I" },
};

function round4(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

export function validateBasketWeights(weights: (number | null | undefined)[]): void {
  const sum = weights.reduce((acc, w) => acc + (w ?? 0), 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(`Stock weights must sum to exactly 100% (currently ${sum.toFixed(2)}%)`);
  }
}

/** Every window we report, longest first. */
type Window = keyof typeof PERIOD_DAYS;
const WINDOWS: Window[] = ["fiveYear", "threeYear", "oneYear", "sixMonth", "threeMonth", "oneMonth"];
const LONGEST_DAYS = PERIOD_DAYS.fiveYear;

/** One instrument's market data: the current price and a single long history. */
type Series = { current: number | null; candles: Candle[] };

/**
 * One instrument's data in a single request: a daily series long enough to
 * cover every window we report, and the current price.
 *
 * Both come from the one series. Yahoo's final daily bar is the live session
 * once trading opens and its close tracks the quote exactly, so asking for a
 * price separately would be a second call for a number already in hand.
 *
 * Prices came from the broker before, which is why a basket sat frozen at
 * whatever CMP was last written to the database: an expired token failed both
 * the quote and the history, and the catch below falls back to the stored
 * price with no candles — no candles meaning every window reports "—".
 * Yahoo needs no credentials and cannot expire out from under the page.
 */
async function loadSeries(
  symbol: string,
  exchange: string,
  storedPrice: number | null,
): Promise<Series> {
  try {
    const candles = await getYahooCandles({
      tradingSymbol: symbol,
      exchange,
      interval: "ONE_DAY",
      days: LONGEST_DAYS + 5,
    });
    if (!candles.length) return { current: storedPrice, candles: [] };

    const lastClose = Number(candles[candles.length - 1]!.close);
    return {
      current: Number.isFinite(lastClose) && lastClose > 0 ? lastClose : storedPrice,
      candles,
    };
  } catch {
    return { current: storedPrice, candles: [] };
  }
}

/**
 * The close `daysAgo` days back, read out of an already-loaded series.
 *
 * Returns null when the series does not actually reach that far. A feed can
 * silently return a shorter history than requested, and the old
 * code took `candles.find(c => date >= target)` — which the OLDEST bar always
 * satisfies once the series starts after the target. A 5Y window would quietly
 * use a three-month-old price and publish it as a five-year return. A wrong
 * number carrying a window label is worse than "—".
 */
function priceFromSeries(candles: Candle[], daysAgo: number): number | null {
  if (!candles.length) return null;

  const target = new Date();
  target.setDate(target.getDate() - daysAgo);

  // A week of slack absorbs weekends and holidays at the boundary.
  const BOUNDARY_SLACK_MS = 7 * 24 * 60 * 60 * 1000;
  if (new Date(candles[0].timestamp).getTime() > target.getTime() + BOUNDARY_SLACK_MS) {
    return null;
  }

  const row = candles.find((c) => new Date(c.timestamp) >= target);
  const close = Number(row?.close);
  return Number.isFinite(close) && close > 0 ? close : null;
}

type WindowReturns = Partial<Record<Window | "since_launch", number | null>>;

/**
 * Weighted return for every window, from one fetch per holding, plus the live
 * price each holding resolved to.
 *
 * The prices come back with the returns so the caller can refresh stored CMP
 * from them. Otherwise the CMP refresh loop calls the resolver again per
 * holding — and now that the resolver pulls a five-year candle series, that
 * would be a second full history download per stock for a number we already
 * have in hand.
 */
async function basketReturns(
  stocks: StockRow[],
): Promise<{ returns: WindowReturns; prices: Map<string, number>; series: Candle[] }> {
  const weighted = stocks.filter((s) => (toNumber(s.weightPct) ?? 0) > 0);
  const out: WindowReturns = {};
  const prices = new Map<string, number>();
  if (!weighted.length) return { returns: out, prices, series: [] };

  // Sequential: one upstream, one request per holding, and a basket is small.
  const loaded: { stock: StockRow; weight: number; series: Series }[] = [];
  for (const stock of weighted) {
    const stored = toNumber(stock.entryPrice) ?? toNumber(stock.cmp);
    loaded.push({
      stock,
      weight: toNumber(stock.weightPct) ?? 0,
      series: await loadSeries(stock.symbol, stock.exchange, stored),
    });
  }

  const accumulate = (baseFor: (row: (typeof loaded)[number]) => number | null): number | null => {
    let acc = 0;
    let totalWeight = 0;
    for (const row of loaded) {
      const current = row.series.current;
      const base = baseFor(row);
      if (current == null || base == null || base <= 0) continue;
      acc += (row.weight / 100) * (((current - base) / base) * 100);
      totalWeight += row.weight;
    }
    return totalWeight > 0 ? round4(acc) : null;
  };

  for (const w of WINDOWS) {
    out[w] = accumulate((row) => priceFromSeries(row.series.candles, PERIOD_DAYS[w]));
  }

  // Since launch measures from the recorded entry price — that is what it means.
  out.since_launch = accumulate(
    (row) => toNumber(row.stock.entryPrice) ?? toNumber(row.stock.cmp),
  );

  for (const row of loaded) {
    if (row.series.current != null) prices.set(row.stock.symbol.toUpperCase(), row.series.current);
  }

  /*
   * A synthetic daily series for the basket as a whole, used only for beta.
   *
   * Each day's value is the weighted sum of the holdings' closes on that date.
   * Days where any holding has no bar are dropped rather than carried forward:
   * a stale close would show as a 0% move for that stock and drag the measured
   * volatility down, understating beta.
   */
  const byDay = new Map<string, { total: number; weight: number }>();
  for (const row of loaded) {
    for (const c of row.series.candles) {
      const d = c.timestamp.slice(0, 10);
      const close = Number(c.close);
      if (!Number.isFinite(close) || close <= 0) continue;
      const cell = byDay.get(d) ?? { total: 0, weight: 0 };
      cell.total += (row.weight / 100) * close;
      cell.weight += row.weight;
      byDay.set(d, cell);
    }
  }
  const fullWeight = loaded.reduce((t, r) => t + r.weight, 0);
  const series: Candle[] = [...byDay.entries()]
    .filter(([, v]) => Math.abs(v.weight - fullWeight) < 0.01)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => ({
      timestamp: d,
      open: v.total,
      high: v.total,
      low: v.total,
      close: v.total,
      volume: 0,
    }));

  return { returns: out, prices, series };
}

/** Benchmark index return for every window, from one fetch. */
/**
 * Beta: how much the basket moves for a given move in the index.
 *
 * beta = cov(basket, benchmark) / var(benchmark), over aligned daily returns.
 *
 * beta 1.0  → moves with the index
 * beta 1.5  → amplifies it by half again (more risk taken)
 * beta 0.6  → damped
 *
 * This is what turns "we beat the index by X" into "we beat what our risk level
 * predicted by X". Both series are already in hand from the sweep, so the only
 * cost is arithmetic.
 *
 * Series are aligned by date, not by index — a holding suspended for a session
 * has one fewer bar than the index, and zipping positionally would silently
 * pair each day with the wrong one from there on.
 */
function computeBeta(basket: Candle[], bench: Candle[]): number | null {
  if (basket.length < 30 || bench.length < 30) return null;

  const day = (c: Candle) => c.timestamp.slice(0, 10);
  const benchByDay = new Map(bench.map((c) => [day(c), Number(c.close)]));

  const pairs: { a: number; b: number }[] = [];
  for (let i = 1; i < basket.length; i++) {
    const prevB = benchByDay.get(day(basket[i - 1]));
    const currB = benchByDay.get(day(basket[i]));
    const prevA = Number(basket[i - 1].close);
    const currA = Number(basket[i].close);
    if (!prevB || !currB || !prevA || !currA) continue;
    pairs.push({ a: (currA - prevA) / prevA, b: (currB - prevB) / prevB });
  }

  // Too few overlapping sessions for the number to mean anything.
  if (pairs.length < 30) return null;

  const meanA = pairs.reduce((t, p) => t + p.a, 0) / pairs.length;
  const meanB = pairs.reduce((t, p) => t + p.b, 0) / pairs.length;
  let cov = 0;
  let varB = 0;
  for (const p of pairs) {
    cov += (p.a - meanA) * (p.b - meanB);
    varB += (p.b - meanB) ** 2;
  }
  if (varB === 0) return null;
  return cov / varB;
}

async function benchmarkReturns(
  benchmark: FinuerBenchmark,
): Promise<{ returns: WindowReturns; series: Candle[] }> {
  const out: WindowReturns = {};

  /*
   * Resolve the index. The known-index mapping wins when the name matches,
   * since a benchmark saved with a blank symbol still has a name.
   */
  const mapped = BENCHMARK_INDEX[benchmark.name.toLowerCase()];
  const exch = mapped?.exchange ?? benchmark.exchange ?? "NSE";
  const sym = benchmark.symbol?.trim() || mapped?.symbol;

  try {
    if (!sym) return { returns: out, series: [] };

    const candles = await getYahooCandles({
      tradingSymbol: sym,
      exchange: exch,
      interval: "ONE_DAY",
      days: LONGEST_DAYS + 5,
    });
    if (!candles.length) return { returns: out, series: [] };

    const lastClose = Number(candles[candles.length - 1]!.close);
    const current = Number.isFinite(lastClose) && lastClose > 0 ? lastClose : null;
    if (current == null) return { returns: out, series: candles };

    for (const w of WINDOWS) {
      const base = priceFromSeries(candles, PERIOD_DAYS[w]);
      out[w] = base == null ? null : round4(((current - base) / base) * 100);
    }

    // The index has no "launch" of its own; measure it over the longest window
    // the data supports so the since-launch comparison has something to sit
    // against rather than defaulting the basket to "underperforming".
    const longest = WINDOWS.find((w) => out[w] != null);
    out.since_launch = longest ? out[longest] : null;

    return { returns: out, series: candles };
  } catch {
    return { returns: out, series: [] };
  }
}


export async function recalculateBasketPerformance(basketId: number) {
  const basket = await prisma.finuerBasket.findUnique({
    where: { id: basketId },
    include: {
      benchmark: true,
      stocks: { where: { deletedAt: null } },
    },
  });
  if (!basket) throw new Error("Basket not found");

  const stocks = basket.stocks;
  if (!stocks.length) {
    throw new Error("Add stocks before calculating performance");
  }

  validateBasketWeights(stocks.map((s) => toNumber(s.weightPct)));

  // One pass per side, not one per window: every window is derived from the
  // same series, so they cannot disagree with each other.
  const { returns: b, prices, series: basketSeries } = await basketReturns(stocks);
  const { returns: bm, series: benchSeries } = await benchmarkReturns(basket.benchmark);

  // Risk-adjusted context for the excess return. Null when the two series do
  // not overlap enough for the regression to mean anything.
  const beta = computeBeta(basketSeries, benchSeries);

  const oneMonthReturn = b.oneMonth ?? null;
  const threeMonthReturn = b.threeMonth ?? null;
  const sixMonthReturn = b.sixMonth ?? null;
  const oneYearReturn = b.oneYear ?? null;
  const threeYearReturn = b.threeYear ?? null;
  const fiveYearReturn = b.fiveYear ?? null;
  const sinceLaunchReturn = b.since_launch ?? null;

  const benchmarkOneMonth = bm.oneMonth ?? null;
  const benchmarkThreeMonth = bm.threeMonth ?? null;
  const benchmarkSixMonth = bm.sixMonth ?? null;
  const benchmarkOneYear = bm.oneYear ?? null;
  const benchmarkThreeYear = bm.threeYear ?? null;
  const benchmarkFiveYear = bm.fiveYear ?? null;
  const benchmarkSinceLaunch = bm.since_launch ?? null;

  /*
   * Judge on the longest window both sides actually have.
   *
   * This compared since-launch only. Since-launch needs a recorded entryPrice
   * on every holding, which a basket entered as symbols-and-weights does not
   * have, so the comparison was null vs null and every basket fell to the
   * "underperforming" default — the label was never a verdict.
   */
  const comparable = (["fiveYear", "threeYear", "oneYear", "sixMonth", "threeMonth", "oneMonth"] as const)
    .find((w) => b[w] != null && bm[w] != null);
  const performanceStatus = comparable
    ? computePerformanceStatus(b[comparable] ?? null, bm[comparable] ?? null)
    : computePerformanceStatus(sinceLaunchReturn, benchmarkSinceLaunch);

  const payload = {
    oneMonthReturn,
    threeMonthReturn,
    sixMonthReturn,
    oneYearReturn,
    threeYearReturn,
    fiveYearReturn,
    sinceLaunchReturn,
    benchmarkOneMonth,
    benchmarkThreeMonth,
    benchmarkSixMonth,
    benchmarkOneYear,
    benchmarkThreeYear,
    benchmarkFiveYear,
    benchmarkSinceLaunch,
    performanceStatus,
    beta: beta == null ? null : round4(beta),
    lastCalculatedAt: new Date(),
  };

  await prisma.finuerBasketPerformance.upsert({
    where: { basketId },
    create: { basketId, ...payload },
    update: payload,
  });

  // Refresh stored CMP from the prices resolved above — no second round trip.
  for (const stock of stocks) {
    const ltp = prices.get(stock.symbol.toUpperCase());
    if (ltp != null && ltp !== toNumber(stock.cmp)) {
      await prisma.finuerBasketStock.update({
        where: { id: stock.id },
        data: { cmp: ltp },
      });
    }
  }

  return prisma.finuerBasketPerformance.findUnique({ where: { basketId } });
}

/**
 * A single instrument's current price.
 *
 * Goes through loadSeries so quote resolution lives in exactly one place —
 * including its fallback to the newest candle close when the live quote is
 * rate-limited.
 */
async function resolveLtp(
  symbol: string,
  exchange: string,
  fallback: number | null,
): Promise<number | null> {
  const { current } = await loadSeries(symbol, exchange, fallback);
  return current;
}

export async function fetchEntryPrice(symbol: string, exchange: string): Promise<number | null> {
  return resolveLtp(symbol, exchange, null);
}

