import type { FinuerBasketStock, FinuerBenchmark } from "@prisma/client";
import { getCandles, getLTP, searchSymbol } from "@/lib/angelone";
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

const BENCHMARK_INDEX: Record<string, { symbol: string; token: string }> = {
  "nifty 50": { symbol: "NIFTY", token: "99926000" },
  "nifty50": { symbol: "NIFTY", token: "99926000" },
  "nifty bank": { symbol: "BANKNIFTY", token: "99926009" },
  "bank nifty": { symbol: "BANKNIFTY", token: "99926009" },
  "sensex": { symbol: "SENSEX", token: "99919000" },
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

async function resolveLtp(
  symbol: string,
  exchange: string,
  fallback: number | null,
): Promise<number | null> {
  try {
    const hits = await searchSymbol(exchange, symbol);
    const hit = hits.find((h) => h.tradingSymbol?.toUpperCase() === symbol.toUpperCase()) ?? hits[0];
    if (!hit?.token) return fallback;
    const rows = await getLTP([{ exchange: hit.exchange ?? exchange, symboltoken: hit.token }]);
    const ltp = rows[0]?.ltp;
    if (ltp != null && Number.isFinite(Number(ltp))) return Number(ltp);
  } catch {
    // AngelOne unavailable — use stored CMP
  }
  return fallback;
}

async function priceAtDaysAgo(
  symbol: string,
  exchange: string,
  daysAgo: number,
  fallback: number | null,
): Promise<number | null> {
  try {
    const hits = await searchSymbol(exchange, symbol);
    const hit = hits.find((h) => h.tradingSymbol?.toUpperCase() === symbol.toUpperCase()) ?? hits[0];
    if (!hit?.token) return fallback;

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - daysAgo - 5);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 09:15`;

    const candles = await getCandles({
      exchange: hit.exchange ?? exchange,
      symboltoken: hit.token,
      tradingSymbol: hit.tradingSymbol,
      interval: "ONE_DAY",
      fromdate: fmt(from),
      todate: fmt(to),
    });
    if (!candles.length) return fallback;
    const target = new Date();
    target.setDate(target.getDate() - daysAgo);
    const row = candles.find((c) => new Date(c[0]) >= target) ?? candles[0];
    const close = Number(row[4]);
    return Number.isFinite(close) ? close : fallback;
  } catch {
    return fallback;
  }
}

async function weightedBasketReturn(
  stocks: StockRow[],
  mode: "since_launch" | keyof typeof PERIOD_DAYS,
): Promise<number | null> {
  const weighted = stocks.filter((s) => (toNumber(s.weightPct) ?? 0) > 0);
  if (!weighted.length) return null;

  let totalWeight = 0;
  let acc = 0;

  for (const stock of weighted) {
    const weight = toNumber(stock.weightPct) ?? 0;
    const entry = toNumber(stock.entryPrice) ?? toNumber(stock.cmp);
    const current = await resolveLtp(stock.symbol, stock.exchange, toNumber(stock.cmp));
    if (entry == null || entry <= 0 || current == null) continue;

    let base = entry;
    if (mode !== "since_launch") {
      const days = PERIOD_DAYS[mode];
      base = (await priceAtDaysAgo(stock.symbol, stock.exchange, days, entry)) ?? entry;
      if (base <= 0) continue;
    }

    const ret = ((current - base) / base) * 100;
    acc += (weight / 100) * ret;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return null;
  return round4(acc);
}

async function benchmarkReturn(
  benchmark: FinuerBenchmark,
  mode: "since_launch" | keyof typeof PERIOD_DAYS,
): Promise<number | null> {
  const symbol = benchmark.symbol?.trim();
  const token = benchmark.symbol ? undefined : BENCHMARK_INDEX[benchmark.name.toLowerCase()]?.token;
  const mapped = BENCHMARK_INDEX[benchmark.name.toLowerCase()];
  const exch = benchmark.exchange ?? "NSE";
  const sym = symbol ?? mapped?.symbol;
  if (!sym && !token) return null;

  try {
    let symboltoken = token;
    if (!symboltoken && sym) {
      const hits = await searchSymbol(exch, sym);
      symboltoken = hits[0]?.token;
    }
    if (!symboltoken) return null;

    const currentRows = await getLTP([{ exchange: exch, symboltoken }]);
    const current = Number(currentRows[0]?.ltp);
    if (!Number.isFinite(current)) return null;

    let base = current;
    if (mode !== "since_launch") {
      const days = PERIOD_DAYS[mode];
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - days - 5);
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 09:15`;
      const candles = await getCandles({
        exchange: exch,
        symboltoken,
        interval: "ONE_DAY",
        fromdate: fmt(from),
        todate: fmt(to),
      });
      const target = new Date();
      target.setDate(target.getDate() - days);
      const row = candles.find((c) => new Date(c[0]) >= target) ?? candles[0];
      base = Number(row?.[4]);
      if (!Number.isFinite(base) || base <= 0) return null;
    } else {
      return 0;
    }

    return round4(((current - base) / base) * 100);
  } catch {
    return null;
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

  const [
    oneMonthReturn,
    threeMonthReturn,
    sixMonthReturn,
    oneYearReturn,
    threeYearReturn,
    fiveYearReturn,
    sinceLaunchReturn,
  ] = await Promise.all([
    weightedBasketReturn(stocks, "oneMonth"),
    weightedBasketReturn(stocks, "threeMonth"),
    weightedBasketReturn(stocks, "sixMonth"),
    weightedBasketReturn(stocks, "oneYear"),
    weightedBasketReturn(stocks, "threeYear"),
    weightedBasketReturn(stocks, "fiveYear"),
    weightedBasketReturn(stocks, "since_launch"),
  ]);

  const [
    benchmarkOneMonth,
    benchmarkThreeMonth,
    benchmarkSixMonth,
    benchmarkOneYear,
    benchmarkThreeYear,
    benchmarkFiveYear,
    benchmarkSinceLaunch,
  ] = await Promise.all([
    benchmarkReturn(basket.benchmark, "oneMonth"),
    benchmarkReturn(basket.benchmark, "threeMonth"),
    benchmarkReturn(basket.benchmark, "sixMonth"),
    benchmarkReturn(basket.benchmark, "oneYear"),
    benchmarkReturn(basket.benchmark, "threeYear"),
    benchmarkReturn(basket.benchmark, "fiveYear"),
    benchmarkReturn(basket.benchmark, "since_launch"),
  ]);

  const performanceStatus = computePerformanceStatus(sinceLaunchReturn, benchmarkSinceLaunch);

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
    lastCalculatedAt: new Date(),
  };

  await prisma.finuerBasketPerformance.upsert({
    where: { basketId },
    create: { basketId, ...payload },
    update: payload,
  });

  // Refresh CMP on stocks from live quotes
  for (const stock of stocks) {
    const ltp = await resolveLtp(stock.symbol, stock.exchange, toNumber(stock.cmp));
    if (ltp != null) {
      await prisma.finuerBasketStock.update({
        where: { id: stock.id },
        data: { cmp: ltp },
      });
    }
  }

  return prisma.finuerBasketPerformance.findUnique({ where: { basketId } });
}

export async function fetchEntryPrice(symbol: string, exchange: string): Promise<number | null> {
  return resolveLtp(symbol, exchange, null);
}
