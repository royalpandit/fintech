import { Prisma } from "@prisma/client";
import type {
  FinuerBasket,
  FinuerBasketPerformance,
  FinuerBasketStock,
  FinuerBasketType,
  FinuerBenchmark,
  FinuerMarket,
  User,
} from "@prisma/client";

type Decimal = Prisma.Decimal;

export const FINUER_BASKET_TIME_PERIODS = [
  "1_month",
  "3_months",
  "6_months",
  "1_year",
  "3_years",
  "5_years",
  "since_launch",
] as const;

export type FinuerBasketTimePeriod = (typeof FINUER_BASKET_TIME_PERIODS)[number];

export const FINUER_BASKET_SORT_ORDERS = ["highest_return", "lowest_return"] as const;
export type FinuerBasketSortOrder = (typeof FINUER_BASKET_SORT_ORDERS)[number];

export type BasketReturnField =
  | "oneMonthReturn"
  | "threeMonthReturn"
  | "sixMonthReturn"
  | "oneYearReturn"
  | "threeYearReturn"
  | "fiveYearReturn"
  | "sinceLaunchReturn";

export type BenchmarkReturnField =
  | "benchmarkOneMonth"
  | "benchmarkThreeMonth"
  | "benchmarkSixMonth"
  | "benchmarkOneYear"
  | "benchmarkThreeYear"
  | "benchmarkFiveYear"
  | "benchmarkSinceLaunch";

const RETURN_FIELD_MAP: Record<FinuerBasketTimePeriod, BasketReturnField> = {
  "1_month": "oneMonthReturn",
  "3_months": "threeMonthReturn",
  "6_months": "sixMonthReturn",
  "1_year": "oneYearReturn",
  "3_years": "threeYearReturn",
  "5_years": "fiveYearReturn",
  since_launch: "sinceLaunchReturn",
};

const BENCHMARK_FIELD_MAP: Record<FinuerBasketTimePeriod, BenchmarkReturnField> = {
  "1_month": "benchmarkOneMonth",
  "3_months": "benchmarkThreeMonth",
  "6_months": "benchmarkSixMonth",
  "1_year": "benchmarkOneYear",
  "3_years": "benchmarkThreeYear",
  "5_years": "benchmarkFiveYear",
  since_launch: "benchmarkSinceLaunch",
};

export type FinuerBasketWithRelations = FinuerBasket & {
  market: FinuerMarket;
  type: FinuerBasketType;
  benchmark: FinuerBenchmark;
  performance: FinuerBasketPerformance | null;
  createdBy?: Pick<User, "id" | "fullName" | "email"> | null;
  stocks?: FinuerBasketStock[] | Pick<FinuerBasketStock, "symbol" | "stockName">[];
  rebalanceEvents?: import("@prisma/client").FinuerBasketRebalanceEvent[];
  _count?: { stocks: number };
};

export function toNumber(value: Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : Number(value);
}

export function formatReturnPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function parseTimePeriod(value: string | null | undefined): FinuerBasketTimePeriod {
  if (value && FINUER_BASKET_TIME_PERIODS.includes(value as FinuerBasketTimePeriod)) {
    return value as FinuerBasketTimePeriod;
  }
  return "1_year";
}

export function parseSortOrder(value: string | null | undefined): FinuerBasketSortOrder | null {
  if (value && FINUER_BASKET_SORT_ORDERS.includes(value as FinuerBasketSortOrder)) {
    return value as FinuerBasketSortOrder;
  }
  return null;
}

export function getReturnField(timePeriod: FinuerBasketTimePeriod): BasketReturnField {
  return RETURN_FIELD_MAP[timePeriod];
}

export function getBenchmarkField(timePeriod: FinuerBasketTimePeriod): BenchmarkReturnField {
  return BENCHMARK_FIELD_MAP[timePeriod];
}

export function computePerformanceStatus(
  basketReturn: number | null,
  benchmarkReturn: number | null,
): "outperforming" | "underperforming" {
  if (basketReturn == null || benchmarkReturn == null) return "underperforming";
  return basketReturn > benchmarkReturn ? "outperforming" : "underperforming";
}

export function computeStoredPerformanceStatus(
  performance: Pick<
    FinuerBasketPerformance,
    "sinceLaunchReturn" | "benchmarkSinceLaunch"
  > | null,
): "outperforming" | "underperforming" {
  if (!performance) return "underperforming";
  return computePerformanceStatus(
    toNumber(performance.sinceLaunchReturn),
    toNumber(performance.benchmarkSinceLaunch),
  );
}

export type PerformanceInput = {
  oneMonthReturn?: number | null;
  threeMonthReturn?: number | null;
  sixMonthReturn?: number | null;
  oneYearReturn?: number | null;
  threeYearReturn?: number | null;
  fiveYearReturn?: number | null;
  sinceLaunchReturn?: number | null;
  benchmarkOneMonth?: number | null;
  benchmarkThreeMonth?: number | null;
  benchmarkSixMonth?: number | null;
  benchmarkOneYear?: number | null;
  benchmarkThreeYear?: number | null;
  benchmarkFiveYear?: number | null;
  benchmarkSinceLaunch?: number | null;
};

export function normalizePerformanceInput(raw: unknown): PerformanceInput {
  if (!raw || typeof raw !== "object") return {};
  const body = raw as Record<string, unknown>;
  const num = (key: string) => {
    const v = body[key];
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    oneMonthReturn: num("oneMonthReturn"),
    threeMonthReturn: num("threeMonthReturn"),
    sixMonthReturn: num("sixMonthReturn"),
    oneYearReturn: num("oneYearReturn"),
    threeYearReturn: num("threeYearReturn"),
    fiveYearReturn: num("fiveYearReturn"),
    sinceLaunchReturn: num("sinceLaunchReturn"),
    benchmarkOneMonth: num("benchmarkOneMonth"),
    benchmarkThreeMonth: num("benchmarkThreeMonth"),
    benchmarkSixMonth: num("benchmarkSixMonth"),
    benchmarkOneYear: num("benchmarkOneYear"),
    benchmarkThreeYear: num("benchmarkThreeYear"),
    benchmarkFiveYear: num("benchmarkFiveYear"),
    benchmarkSinceLaunch: num("benchmarkSinceLaunch"),
  };
}

export function serializePerformance(
  performance: FinuerBasketPerformance | null,
  timePeriod: FinuerBasketTimePeriod = "1_year",
) {
  if (!performance) {
    return {
      oneMonthReturn: null,
      threeMonthReturn: null,
      sixMonthReturn: null,
      oneYearReturn: null,
      threeYearReturn: null,
      fiveYearReturn: null,
      sinceLaunchReturn: null,
      benchmarkOneMonth: null,
      benchmarkThreeMonth: null,
      benchmarkSixMonth: null,
      benchmarkOneYear: null,
      benchmarkThreeYear: null,
      benchmarkFiveYear: null,
      benchmarkSinceLaunch: null,
      basketReturn: null,
      benchmarkReturn: null,
      performanceStatus: "underperforming" as const,
    };
  }

  const basketField = getReturnField(timePeriod);
  const benchmarkField = getBenchmarkField(timePeriod);
  const basketReturn = toNumber(performance[basketField]);
  const benchmarkReturn = toNumber(performance[benchmarkField]);
  const performanceStatus = computePerformanceStatus(basketReturn, benchmarkReturn);

  return {
    oneMonthReturn: toNumber(performance.oneMonthReturn),
    threeMonthReturn: toNumber(performance.threeMonthReturn),
    sixMonthReturn: toNumber(performance.sixMonthReturn),
    oneYearReturn: toNumber(performance.oneYearReturn),
    threeYearReturn: toNumber(performance.threeYearReturn),
    fiveYearReturn: toNumber(performance.fiveYearReturn),
    sinceLaunchReturn: toNumber(performance.sinceLaunchReturn),
    benchmarkOneMonth: toNumber(performance.benchmarkOneMonth),
    benchmarkThreeMonth: toNumber(performance.benchmarkThreeMonth),
    benchmarkSixMonth: toNumber(performance.benchmarkSixMonth),
    benchmarkOneYear: toNumber(performance.benchmarkOneYear),
    benchmarkThreeYear: toNumber(performance.benchmarkThreeYear),
    benchmarkFiveYear: toNumber(performance.benchmarkFiveYear),
    benchmarkSinceLaunch: toNumber(performance.benchmarkSinceLaunch),
    basketReturn,
    benchmarkReturn,
    performanceStatus,
    storedPerformanceStatus: performance.performanceStatus,
  };
}

export function serializeMarket(market: FinuerMarket) {
  return {
    id: market.id,
    name: market.name,
    status: market.status,
    createdAt: market.createdAt.toISOString(),
    updatedAt: market.updatedAt.toISOString(),
  };
}

export function serializeType(type: FinuerBasketType) {
  return {
    id: type.id,
    name: type.name,
    status: type.status,
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  };
}

export function serializeBenchmark(
  benchmark: FinuerBenchmark & { market?: FinuerMarket },
) {
  return {
    id: benchmark.id,
    marketId: benchmark.marketId,
    marketName: benchmark.market?.name ?? null,
    name: benchmark.name,
    createdAt: benchmark.createdAt.toISOString(),
    updatedAt: benchmark.updatedAt.toISOString(),
  };
}

export function serializeBasketStock(stock: FinuerBasketStock) {
  return {
    id: stock.id,
    basketId: stock.basketId,
    symbol: stock.symbol,
    stockName: stock.stockName,
    exchange: stock.exchange,
    weightPct: toNumber(stock.weightPct),
    cmp: toNumber(stock.cmp),
    entryPrice: toNumber(stock.entryPrice),
    sortOrder: stock.sortOrder,
  };
}

export function serializeRebalanceEvent(
  event: {
    id: number;
    action: string;
    symbol: string;
    stockName: string | null;
    oldWeight: Decimal | null;
    newWeight: Decimal | null;
    reason: string | null;
    createdAt: Date;
  },
) {
  return {
    id: event.id,
    action: event.action,
    symbol: event.symbol,
    stockName: event.stockName,
    oldWeight: toNumber(event.oldWeight),
    newWeight: toNumber(event.newWeight),
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
  };
}

export function serializeBasket(
  basket: FinuerBasketWithRelations,
  timePeriod: FinuerBasketTimePeriod = "1_year",
  options?: { includeStocks?: boolean; includeRebalance?: boolean },
) {
  const stocks = basket.stocks?.filter((s) => !s.deletedAt).map(serializeBasketStock) ?? [];
  const stockCount = basket._count?.stocks ?? stocks.length;
  const perf = serializePerformance(basket.performance, timePeriod);
  const alpha =
    perf.basketReturn != null && perf.benchmarkReturn != null
      ? Math.round((perf.basketReturn - perf.benchmarkReturn) * 100) / 100
      : null;

  return {
    id: basket.id,
    basketName: basket.basketName,
    shortDescription: basket.shortDescription,
    methodology: basket.methodology ?? null,
    marketId: basket.marketId,
    market: basket.market.name,
    typeId: basket.typeId,
    type: basket.type.name,
    benchmarkId: basket.benchmarkId,
    benchmark: basket.benchmark.name,
    status: basket.status,
    visibility: basket.visibility,
    rebalanceFrequency: basket.rebalanceFrequency,
    requiredPlan: basket.requiredPlan,
    lastRebalancedAt: basket.lastRebalancedAt?.toISOString() ?? null,
    stockCount,
    stocks: options?.includeStocks === false ? undefined : stocks,
    rebalanceEvents:
      options?.includeRebalance && "rebalanceEvents" in basket
        ? (basket as FinuerBasketWithRelations & { rebalanceEvents: Parameters<typeof serializeRebalanceEvent>[0][] })
            .rebalanceEvents?.map(serializeRebalanceEvent)
        : undefined,
    createdBy: basket.createdBy
      ? {
          id: basket.createdBy.id,
          fullName: basket.createdBy.fullName,
          email: basket.createdBy.email,
        }
      : null,
    createdAt: basket.createdAt.toISOString(),
    updatedAt: basket.updatedAt.toISOString(),
    performance: { ...perf, alpha },
  };
}

export function sortBasketsByReturn<T extends { performance: FinuerBasketPerformance | null }>(
  rows: T[],
  timePeriod: FinuerBasketTimePeriod,
  sortOrder: FinuerBasketSortOrder,
): T[] {
  const field = getReturnField(timePeriod);
  const dir = sortOrder === "highest_return" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = toNumber(a.performance?.[field]) ?? (sortOrder === "lowest_return" ? Infinity : -Infinity);
    const bv = toNumber(b.performance?.[field]) ?? (sortOrder === "lowest_return" ? Infinity : -Infinity);
    if (av === bv) return 0;
    return av < bv ? dir : -dir;
  });
}

/** API documentation metadata for Finuer Basket endpoints */
export const FINUER_BASKET_API_DOCS = {
  admin: {
    markets: {
      list: "GET /api/v1/admin/markets",
      create: "POST /api/v1/admin/markets { name, status? }",
      update: "PUT /api/v1/admin/markets/:id { name?, status? }",
      delete: "DELETE /api/v1/admin/markets/:id",
    },
    types: {
      list: "GET /api/v1/admin/types",
      create: "POST /api/v1/admin/types { name, status? }",
      update: "PUT /api/v1/admin/types/:id { name?, status? }",
      delete: "DELETE /api/v1/admin/types/:id",
    },
    benchmarks: {
      list: "GET /api/v1/admin/benchmarks?market_id=",
      create: "POST /api/v1/admin/benchmarks { marketId, name }",
      update: "PUT /api/v1/admin/benchmarks/:id { marketId?, name? }",
      delete: "DELETE /api/v1/admin/benchmarks/:id",
    },
    baskets: {
      list: "GET /api/v1/admin/baskets?market_id=&type_id=&time_period=&sort_order=&search=",
      create:
        "POST /api/v1/admin/baskets { basketName, shortDescription?, methodology?, marketId, typeId, benchmarkId, status?, visibility?, rebalanceFrequency?, requiredPlan? }",
      get: "GET /api/v1/admin/baskets/:id",
      update: "PUT /api/v1/admin/baskets/:id",
      delete: "DELETE /api/v1/admin/baskets/:id",
      activate: "PATCH /api/v1/admin/baskets/:id { status: 'active' | 'inactive' }",
      recalculate: "POST /api/v1/admin/baskets/:id/recalculate — auto-calculate performance from holdings",
      stocks: {
        list: "GET /api/v1/admin/baskets/:id/stocks",
        add: "POST /api/v1/admin/baskets/:id/stocks { symbol, stockName, exchange?, weightPct?, reason? }",
        update: "PUT /api/v1/admin/baskets/:id/stocks/:stockId",
        delete: "DELETE /api/v1/admin/baskets/:id/stocks/:stockId",
      },
      rebalanceHistory: "GET /api/v1/admin/baskets/:id/rebalance-events",
    },
  },
  user: {
    list: "GET /api/v1/baskets?market_id=&type_id=&time_period=&sort_order=&search= — active + public only",
    detail: "GET /api/v1/baskets/:id — basket with stocks + rebalance history",
  },
} as const;
