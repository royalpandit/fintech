import type { FinuerBasketStock, FinuerBenchmark } from "@prisma/client";
import { getCandles, getLTP, searchSymbol, type SearchResult } from "@/lib/dhan";
import type { Candle } from "@/lib/angelone-types";
import { isEquityInstrument, isIndexInstrument } from "@/lib/instrument-type";
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

const BENCHMARK_INDEX: Record<string, { symbol: string; token: string; exchange: string }> = {
  "nifty 50":   { symbol: "NIFTY",     token: "13", exchange: "IDX_I" },
  "nifty50":    { symbol: "NIFTY",     token: "13", exchange: "IDX_I" },
  "nifty bank": { symbol: "BANKNIFTY", token: "25", exchange: "IDX_I" },
  "bank nifty": { symbol: "BANKNIFTY", token: "25", exchange: "IDX_I" },
  "sensex":     { symbol: "SENSEX",    token: "51", exchange: "IDX_I" },
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

/**
 * Pick the tradable instrument for a plain symbol out of a scrip-master search.
 *
 * searchSymbol keeps derivatives (segment "D"), and the master lists them
 * first, so `searchSymbol("NSE", "RELIANCE")` opens with
 * RELIANCE-Sep2026-700-CE and friends. Both callers below did
 * `hits.find(exact tradingSymbol) ?? hits[0]`, so any symbol whose equity row
 * is not an exact string match silently priced the basket off an option
 * contract — and for a holding entered as "RELIANCE" against Dhan's naming,
 * that is what happened.
 *
 * Returns null rather than falling through to hits[0]: for a published return
 * figure, no number is much better than a number computed from the wrong
 * instrument.
 */
function pickInstrument(hits: SearchResult[], symbol: string): SearchResult | null {
  const want = symbol.toUpperCase().trim();
  const bare = (h: SearchResult) => (h.tradingSymbol ?? "").toUpperCase().replace(/-EQ$/, "");

  return (
    hits.find((h) => isEquityInstrument(h.instrumentType) && bare(h) === want) ??
    hits.find((h) => isIndexInstrument(h.instrumentType) && bare(h) === want) ??
    hits.find((h) => isEquityInstrument(h.instrumentType)) ??
    hits.find((h) => isIndexInstrument(h.instrumentType)) ??
    null
  );
}
/** Every window we report, longest first. */
type Window = keyof typeof PERIOD_DAYS;
const WINDOWS: Window[] = ["fiveYear", "threeYear", "oneYear", "sixMonth", "threeMonth", "oneMonth"];
const LONGEST_DAYS = PERIOD_DAYS.fiveYear;

/** One instrument's market data: the current price and a single long history. */
type Series = { current: number | null; candles: Candle[] };

function fmtDhanDate(d: Date): string {
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 09:15`;
}

/**
 * Fetch one instrument's data once: resolve the token, take a live quote, and
 * pull a single candle series long enough to cover every window we report.
 *
 * This replaces a per-window fetch. Previously each of the seven windows called
 * its own resolve + quote + history, so a five-holding basket fired roughly a
 * hundred Dhan requests, all concurrently. Dhan answered a large share of them
 * with `805 Too many requests`, and because the benchmark was calculated after
 * the holdings it queued behind that storm and came back empty — which is
 * exactly why the benchmark column showed "—" while the basket column had
 * numbers.
 *
 * One series per instrument instead: ~3 calls rather than ~21, and every window
 * is derived from the same data, so the windows are also mutually consistent.
 */
async function loadSeries(
  symbol: string,
  exchange: string,
  storedPrice: number | null,
): Promise<Series> {
  try {
    const hit = pickInstrument(await searchSymbol(exchange, symbol), symbol);
    if (!hit?.token) return { current: storedPrice, candles: [] };

    const exch = hit.exchange ?? exchange;
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - LONGEST_DAYS - 5);

    const candles = await getCandles({
      exchange: exch,
      symboltoken: hit.token,
      tradingSymbol: hit.tradingSymbol,
      interval: "ONE_DAY",
      fromdate: fmtDhanDate(from),
      todate: fmtDhanDate(to),
    });

    let current: number | null = null;
    const rows = await getLTP([{ exchange: exch, symboltoken: hit.token }]);
    const ltp = Number(rows[0]?.ltp);
    if (Number.isFinite(ltp) && ltp > 0) current = ltp;

    // No live quote (throttled, or the segment is shut) — the newest candle
    // close is the same market's price, so use it rather than dropping the
    // instrument and nulling the whole basket.
    if (current == null && candles.length) {
      const lastClose = Number(candles[candles.length - 1].close);
      if (Number.isFinite(lastClose) && lastClose > 0) current = lastClose;
    }

    return { current: current ?? storedPrice, candles };
  } catch {
    return { current: storedPrice, candles: [] };
  }
}

/**
 * The close `daysAgo` days back, read out of an already-loaded series.
 *
 * Returns null when the series does not actually reach that far. Dhan silently
 * returns a shorter history than requested for some instruments, and the old
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

  // Sequential: these calls share one rate limiter, so firing them together
  // only produces 429s that then have to be retried.
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
   * Resolve the index.
   *
   * The known-index mapping wins when the name matches, because it carries the
   * quote-feed token and segment directly. The two identifiers live in
   * different namespaces: the feed wants IDX_I, but the scrip master lists
   * indices under the cash exchange — searchSymbol("IDX_I", "NIFTY") returns
   * nothing while "NSE" returns the INDEX row.
   */
  const mapped = BENCHMARK_INDEX[benchmark.name.toLowerCase()];
  const exch = mapped?.exchange ?? benchmark.exchange ?? "NSE";
  const sym = benchmark.symbol?.trim() || mapped?.symbol;

  try {
    let symboltoken = mapped?.token;
    if (!symboltoken && sym) {
      symboltoken = pickInstrument(await searchSymbol("NSE", sym), sym)?.token;
    }
    if (!symboltoken) return { returns: out, series: [] };

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - LONGEST_DAYS - 5);

    const candles = await getCandles({
      exchange: exch,
      symboltoken,
      tradingSymbol: sym,
      interval: "ONE_DAY",
      fromdate: fmtDhanDate(from),
      todate: fmtDhanDate(to),
    });

    let current: number | null = null;
    const rows = await getLTP([{ exchange: exch, symboltoken }]);
    const ltp = Number(rows[0]?.ltp);
    if (Number.isFinite(ltp) && ltp > 0) current = ltp;
    if (current == null && candles.length) {
      const lastClose = Number(candles[candles.length - 1].close);
      if (Number.isFinite(lastClose) && lastClose > 0) current = lastClose;
    }
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

  // One pass per side, not one per window. The old code ran seven
  // weightedBasketReturn calls concurrently and then seven benchmarkReturn
  // calls, each re-resolving and re-fetching from scratch — about a hundred
  // Dhan requests for a five-holding basket, most of which came back 429.
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

