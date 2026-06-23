import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computePerformanceStatus,
  getReturnField,
  normalizePerformanceInput,
  parseSortOrder,
  parseTimePeriod,
  sortBasketsByReturn,
  type FinuerBasketSortOrder,
  type FinuerBasketTimePeriod,
  type FinuerBasketWithRelations,
  type PerformanceInput,
} from "@/lib/finuer-basket";

const basketIncludeBase = {
  market: true,
  type: true,
  benchmark: true,
  performance: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.FinuerBasketInclude;

const basketIncludeList = {
  ...basketIncludeBase,
  _count: { select: { stocks: { where: { deletedAt: null } } } },
} satisfies Prisma.FinuerBasketInclude;

const basketIncludeDetail = {
  ...basketIncludeBase,
  stocks: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.FinuerBasketInclude;

export type BasketListFilters = {
  marketId?: number | null;
  typeId?: number | null;
  timePeriod?: FinuerBasketTimePeriod;
  sortOrder?: FinuerBasketSortOrder | null;
  publicOnly?: boolean;
  activeOnly?: boolean;
};

function performanceData(input: PerformanceInput) {
  const status = computePerformanceStatus(
    input.sinceLaunchReturn ?? null,
    input.benchmarkSinceLaunch ?? null,
  );

  return {
    oneMonthReturn: input.oneMonthReturn ?? null,
    threeMonthReturn: input.threeMonthReturn ?? null,
    sixMonthReturn: input.sixMonthReturn ?? null,
    oneYearReturn: input.oneYearReturn ?? null,
    threeYearReturn: input.threeYearReturn ?? null,
    fiveYearReturn: input.fiveYearReturn ?? null,
    sinceLaunchReturn: input.sinceLaunchReturn ?? null,
    benchmarkOneMonth: input.benchmarkOneMonth ?? null,
    benchmarkThreeMonth: input.benchmarkThreeMonth ?? null,
    benchmarkSixMonth: input.benchmarkSixMonth ?? null,
    benchmarkOneYear: input.benchmarkOneYear ?? null,
    benchmarkThreeYear: input.benchmarkThreeYear ?? null,
    benchmarkFiveYear: input.benchmarkFiveYear ?? null,
    benchmarkSinceLaunch: input.benchmarkSinceLaunch ?? null,
    performanceStatus: status,
  };
}

export class FinuerBasketRepository {
  // ─── Markets ───────────────────────────────────────────

  listMarkets() {
    return prisma.finuerMarket.findMany({ orderBy: { name: "asc" } });
  }

  findMarketById(id: number) {
    return prisma.finuerMarket.findUnique({ where: { id } });
  }

  createMarket(name: string, status: "active" | "inactive" = "active") {
    return prisma.finuerMarket.create({ data: { name: name.trim(), status } });
  }

  updateMarket(id: number, data: { name?: string; status?: "active" | "inactive" }) {
    return prisma.finuerMarket.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }

  async deleteMarket(id: number) {
    const inUse = await prisma.finuerBasket.count({ where: { marketId: id } });
    if (inUse > 0) throw new Error("Market is used by one or more baskets");
    const benchmarks = await prisma.finuerBenchmark.count({ where: { marketId: id } });
    if (benchmarks > 0) throw new Error("Delete benchmarks for this market first");
    return prisma.finuerMarket.delete({ where: { id } });
  }

  // ─── Types ─────────────────────────────────────────────

  listTypes() {
    return prisma.finuerBasketType.findMany({ orderBy: { name: "asc" } });
  }

  findTypeById(id: number) {
    return prisma.finuerBasketType.findUnique({ where: { id } });
  }

  createType(name: string, status: "active" | "inactive" = "active") {
    return prisma.finuerBasketType.create({ data: { name: name.trim(), status } });
  }

  updateType(id: number, data: { name?: string; status?: "active" | "inactive" }) {
    return prisma.finuerBasketType.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }

  async deleteType(id: number) {
    const inUse = await prisma.finuerBasket.count({ where: { typeId: id } });
    if (inUse > 0) throw new Error("Type is used by one or more baskets");
    return prisma.finuerBasketType.delete({ where: { id } });
  }

  // ─── Benchmarks ────────────────────────────────────────

  listBenchmarks(marketId?: number | null) {
    return prisma.finuerBenchmark.findMany({
      where: marketId ? { marketId } : undefined,
      include: { market: true },
      orderBy: [{ market: { name: "asc" } }, { name: "asc" }],
    });
  }

  findBenchmarkById(id: number) {
    return prisma.finuerBenchmark.findUnique({ where: { id }, include: { market: true } });
  }

  createBenchmark(marketId: number, name: string) {
    return prisma.finuerBenchmark.create({
      data: { marketId, name: name.trim() },
      include: { market: true },
    });
  }

  updateBenchmark(id: number, data: { marketId?: number; name?: string }) {
    return prisma.finuerBenchmark.update({
      where: { id },
      data: {
        ...(data.marketId !== undefined ? { marketId: data.marketId } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      },
      include: { market: true },
    });
  }

  async deleteBenchmark(id: number) {
    const inUse = await prisma.finuerBasket.count({ where: { benchmarkId: id } });
    if (inUse > 0) throw new Error("Benchmark is used by one or more baskets");
    return prisma.finuerBenchmark.delete({ where: { id } });
  }

  // ─── Baskets ───────────────────────────────────────────

  async listBaskets(filters: BasketListFilters = {}): Promise<FinuerBasketWithRelations[]> {
    const timePeriod = filters.timePeriod ?? "1_year";
    const sortOrder = filters.sortOrder ?? null;

    const where: Prisma.FinuerBasketWhereInput = {};
    if (filters.marketId) where.marketId = filters.marketId;
    if (filters.typeId) where.typeId = filters.typeId;
    if (filters.activeOnly) where.status = "active";
    if (filters.publicOnly) where.visibility = "public";

    const rows = await prisma.finuerBasket.findMany({
      where,
      include: basketIncludeList,
      orderBy: { createdAt: "desc" },
    });

    if (sortOrder) {
      return sortBasketsByReturn(rows, timePeriod, sortOrder);
    }
    return rows;
  }

  findBasketById(id: number, withStocks = true) {
    return prisma.finuerBasket.findUnique({
      where: { id },
      include: withStocks ? basketIncludeDetail : basketIncludeList,
    });
  }

  async createBasket(
    data: {
      basketName: string;
      shortDescription?: string | null;
      marketId: number;
      typeId: number;
      benchmarkId: number;
      status?: "active" | "inactive";
      visibility?: "public" | "hidden";
      rebalanceFrequency?: "weekly" | "monthly" | "quarterly";
      requiredPlan?: "free" | "premium";
      createdById?: number;
      performance?: PerformanceInput;
    },
  ) {
    const perf = normalizePerformanceInput(data.performance);
    return prisma.finuerBasket.create({
      data: {
        basketName: data.basketName.trim(),
        shortDescription: data.shortDescription?.trim() || null,
        marketId: data.marketId,
        typeId: data.typeId,
        benchmarkId: data.benchmarkId,
        status: data.status ?? "active",
        visibility: data.visibility ?? "public",
        rebalanceFrequency: data.rebalanceFrequency ?? "monthly",
        requiredPlan: data.requiredPlan ?? "free",
        createdById: data.createdById ?? null,
        performance: {
          create: performanceData(perf),
        },
      },
      include: basketIncludeDetail,
    });
  }

  async listBasketStocks(basketId: number) {
    return prisma.finuerBasketStock.findMany({
      where: { basketId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
    });
  }

  async addBasketStock(
    basketId: number,
    data: {
      symbol: string;
      stockName: string;
      exchange?: string;
      weightPct?: number | null;
      cmp?: number | null;
      sortOrder?: number;
    },
  ) {
    const basket = await prisma.finuerBasket.findUnique({ where: { id: basketId } });
    if (!basket) throw new Error("Basket not found");

    const maxOrder = await prisma.finuerBasketStock.aggregate({
      where: { basketId, deletedAt: null },
      _max: { sortOrder: true },
    });

    return prisma.finuerBasketStock.create({
      data: {
        basketId,
        symbol: data.symbol.trim().toUpperCase(),
        stockName: data.stockName.trim(),
        exchange: data.exchange?.trim().toUpperCase() || "NSE",
        weightPct: data.weightPct ?? null,
        cmp: data.cmp ?? null,
        sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateBasketStock(
    basketId: number,
    stockId: number,
    data: {
      symbol?: string;
      stockName?: string;
      exchange?: string;
      weightPct?: number | null;
      cmp?: number | null;
      sortOrder?: number;
    },
  ) {
    const existing = await prisma.finuerBasketStock.findFirst({
      where: { id: stockId, basketId, deletedAt: null },
    });
    if (!existing) throw new Error("Stock not found");

    return prisma.finuerBasketStock.update({
      where: { id: stockId },
      data: {
        ...(data.symbol !== undefined ? { symbol: data.symbol.trim().toUpperCase() } : {}),
        ...(data.stockName !== undefined ? { stockName: data.stockName.trim() } : {}),
        ...(data.exchange !== undefined ? { exchange: data.exchange.trim().toUpperCase() } : {}),
        ...(data.weightPct !== undefined ? { weightPct: data.weightPct } : {}),
        ...(data.cmp !== undefined ? { cmp: data.cmp } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });
  }

  async deleteBasketStock(basketId: number, stockId: number) {
    const existing = await prisma.finuerBasketStock.findFirst({
      where: { id: stockId, basketId, deletedAt: null },
    });
    if (!existing) throw new Error("Stock not found");
    return prisma.finuerBasketStock.update({
      where: { id: stockId },
      data: { deletedAt: new Date() },
    });
  }

  async updateBasket(
    id: number,
    data: {
      basketName?: string;
      shortDescription?: string | null;
      marketId?: number;
      typeId?: number;
      benchmarkId?: number;
      status?: "active" | "inactive";
      visibility?: "public" | "hidden";
      rebalanceFrequency?: "weekly" | "monthly" | "quarterly";
      requiredPlan?: "free" | "premium";
      performance?: PerformanceInput;
    },
  ) {
    const perf = data.performance ? normalizePerformanceInput(data.performance) : null;

    return prisma.$transaction(async (tx) => {
      const basket = await tx.finuerBasket.update({
        where: { id },
        data: {
          ...(data.basketName !== undefined ? { basketName: data.basketName.trim() } : {}),
          ...(data.shortDescription !== undefined
            ? { shortDescription: data.shortDescription?.trim() || null }
            : {}),
          ...(data.marketId !== undefined ? { marketId: data.marketId } : {}),
          ...(data.typeId !== undefined ? { typeId: data.typeId } : {}),
          ...(data.benchmarkId !== undefined ? { benchmarkId: data.benchmarkId } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
          ...(data.rebalanceFrequency !== undefined
            ? { rebalanceFrequency: data.rebalanceFrequency }
            : {}),
          ...(data.requiredPlan !== undefined ? { requiredPlan: data.requiredPlan } : {}),
        },
      });

      if (perf) {
        const perfPayload = performanceData(perf);
        await tx.finuerBasketPerformance.upsert({
          where: { basketId: basket.id },
          create: { basketId: basket.id, ...perfPayload },
          update: perfPayload,
        });
      }

      return tx.finuerBasket.findUniqueOrThrow({ where: { id }, include: basketIncludeDetail });
    });
  }

  async setBasketStatus(id: number, status: "active" | "inactive") {
    return prisma.finuerBasket.update({
      where: { id },
      data: { status },
      include: basketIncludeDetail,
    });
  }

  deleteBasket(id: number) {
    return prisma.finuerBasket.delete({ where: { id } });
  }

  parseListQuery(searchParams: URLSearchParams): BasketListFilters {
    const marketId = Number(searchParams.get("market_id"));
    const typeId = Number(searchParams.get("type_id"));
    return {
      marketId: Number.isFinite(marketId) && marketId > 0 ? marketId : null,
      typeId: Number.isFinite(typeId) && typeId > 0 ? typeId : null,
      timePeriod: parseTimePeriod(searchParams.get("time_period")),
      sortOrder: parseSortOrder(searchParams.get("sort_order")),
    };
  }

  getSortField(timePeriod: FinuerBasketTimePeriod) {
    return getReturnField(timePeriod);
  }
}

export const finuerBasketRepository = new FinuerBasketRepository();
