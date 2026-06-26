import type { FinuerRebalanceAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchEntryPrice,
  recalculateBasketPerformance,
  validateBasketWeights,
} from "@/lib/finuer-basket-performance";
import {
  getReturnField,
  parseSortOrder,
  parseTimePeriod,
  sortBasketsByReturn,
  toNumber,
  type FinuerBasketSortOrder,
  type FinuerBasketTimePeriod,
  type FinuerBasketWithRelations,
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
  stocks: { where: { deletedAt: null }, select: { symbol: true, stockName: true } },
} satisfies Prisma.FinuerBasketInclude;

const basketIncludeDetail = {
  ...basketIncludeBase,
  stocks: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" as const } },
  rebalanceEvents: { orderBy: { createdAt: "desc" as const }, take: 50 },
} satisfies Prisma.FinuerBasketInclude;

export type BasketListFilters = {
  marketId?: number | null;
  typeId?: number | null;
  timePeriod?: FinuerBasketTimePeriod;
  sortOrder?: FinuerBasketSortOrder | null;
  search?: string | null;
  publicOnly?: boolean;
  activeOnly?: boolean;
};

function rebalanceAction(
  oldWeight: number | null,
  newWeight: number | null,
  isRemove: boolean,
  isAdd: boolean,
): FinuerRebalanceAction {
  if (isRemove) return "remove";
  if (isAdd) return "add";
  if (oldWeight != null && newWeight != null) {
    return newWeight > oldWeight ? "increase_weight" : "decrease_weight";
  }
  return "add";
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

  createBenchmark(marketId: number, name: string, symbol?: string | null) {
    return prisma.finuerBenchmark.create({
      data: { marketId, name: name.trim(), symbol: symbol?.trim() || null },
      include: { market: true },
    });
  }

  updateBenchmark(
    id: number,
    data: { marketId?: number; name?: string; symbol?: string | null; exchange?: string },
  ) {
    return prisma.finuerBenchmark.update({
      where: { id },
      data: {
        ...(data.marketId !== undefined ? { marketId: data.marketId } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.symbol !== undefined ? { symbol: data.symbol?.trim() || null } : {}),
        ...(data.exchange !== undefined ? { exchange: data.exchange } : {}),
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
    const search = filters.search?.trim().toLowerCase();

    const where: Prisma.FinuerBasketWhereInput = {};
    if (filters.marketId) where.marketId = filters.marketId;
    if (filters.typeId) where.typeId = filters.typeId;
    if (filters.activeOnly) where.status = "active";
    if (filters.publicOnly) where.visibility = "public";

    if (search) {
      where.OR = [
        { basketName: { contains: search, mode: "insensitive" } },
        { shortDescription: { contains: search, mode: "insensitive" } },
        { market: { name: { contains: search, mode: "insensitive" } } },
        { type: { name: { contains: search, mode: "insensitive" } } },
        {
          stocks: {
            some: {
              deletedAt: null,
              OR: [
                { symbol: { contains: search, mode: "insensitive" } },
                { stockName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const rows = await prisma.finuerBasket.findMany({
      where,
      include: basketIncludeList,
      orderBy: { updatedAt: "desc" },
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

  listRebalanceEvents(basketId: number) {
    return prisma.finuerBasketRebalanceEvent.findMany({
      where: { basketId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createBasket(data: {
    basketName: string;
    shortDescription?: string | null;
    methodology?: string | null;
    marketId: number;
    typeId: number;
    benchmarkId: number;
    status?: "active" | "inactive";
    visibility?: "public" | "hidden";
    rebalanceFrequency?: "weekly" | "monthly" | "quarterly";
    requiredPlan?: "free" | "premium";
    createdById?: number;
  }) {
    return prisma.finuerBasket.create({
      data: {
        basketName: data.basketName.trim(),
        shortDescription: data.shortDescription?.trim() || null,
        methodology: data.methodology?.trim() || null,
        marketId: data.marketId,
        typeId: data.typeId,
        benchmarkId: data.benchmarkId,
        status: data.status ?? "active",
        visibility: data.visibility ?? "public",
        rebalanceFrequency: data.rebalanceFrequency ?? "monthly",
        requiredPlan: data.requiredPlan ?? "free",
        createdById: data.createdById ?? null,
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
      reason?: string | null;
    },
  ) {
    const basket = await prisma.finuerBasket.findUnique({ where: { id: basketId } });
    if (!basket) throw new Error("Basket not found");

    const exchange = data.exchange?.trim().toUpperCase() || "NSE";
    const entryPrice =
      data.cmp ?? (await fetchEntryPrice(data.symbol.trim().toUpperCase(), exchange));

    const maxOrder = await prisma.finuerBasketStock.aggregate({
      where: { basketId, deletedAt: null },
      _max: { sortOrder: true },
    });

    const newWeight = data.weightPct ?? null;

    const stock = await prisma.$transaction(async (tx) => {
      const created = await tx.finuerBasketStock.create({
        data: {
          basketId,
          symbol: data.symbol.trim().toUpperCase(),
          stockName: data.stockName.trim(),
          exchange,
          weightPct: newWeight,
          cmp: entryPrice,
          entryPrice,
          sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });

      await tx.finuerBasketRebalanceEvent.create({
        data: {
          basketId,
          action: "add",
          symbol: created.symbol,
          stockName: created.stockName,
          oldWeight: null,
          newWeight,
          reason: data.reason?.trim() || null,
        },
      });

      await tx.finuerBasket.update({
        where: { id: basketId },
        data: { lastRebalancedAt: new Date() },
      });

      return created;
    });

    return stock;
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
      reason?: string | null;
    },
  ) {
    const existing = await prisma.finuerBasketStock.findFirst({
      where: { id: stockId, basketId, deletedAt: null },
    });
    if (!existing) throw new Error("Stock not found");

    const oldWeight = toNumber(existing.weightPct);
    const newWeight = data.weightPct !== undefined ? data.weightPct : oldWeight;
    const weightChanged = data.weightPct !== undefined && oldWeight !== newWeight;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.finuerBasketStock.update({
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

      if (weightChanged) {
        await tx.finuerBasketRebalanceEvent.create({
          data: {
            basketId,
            action: rebalanceAction(oldWeight, newWeight, false, false),
            symbol: updated.symbol,
            stockName: updated.stockName,
            oldWeight,
            newWeight,
            reason: data.reason?.trim() || null,
          },
        });
        await tx.finuerBasket.update({
          where: { id: basketId },
          data: { lastRebalancedAt: new Date() },
        });
      }

      return updated;
    });
  }

  async deleteBasketStock(basketId: number, stockId: number, reason?: string | null) {
    const existing = await prisma.finuerBasketStock.findFirst({
      where: { id: stockId, basketId, deletedAt: null },
    });
    if (!existing) throw new Error("Stock not found");

    return prisma.$transaction(async (tx) => {
      await tx.finuerBasketRebalanceEvent.create({
        data: {
          basketId,
          action: "remove",
          symbol: existing.symbol,
          stockName: existing.stockName,
          oldWeight: toNumber(existing.weightPct),
          newWeight: null,
          reason: reason?.trim() || null,
        },
      });

      await tx.finuerBasket.update({
        where: { id: basketId },
        data: { lastRebalancedAt: new Date() },
      });

      return tx.finuerBasketStock.update({
        where: { id: stockId },
        data: { deletedAt: new Date() },
      });
    });
  }

  async updateBasket(
    id: number,
    data: {
      basketName?: string;
      shortDescription?: string | null;
      methodology?: string | null;
      marketId?: number;
      typeId?: number;
      benchmarkId?: number;
      status?: "active" | "inactive";
      visibility?: "public" | "hidden";
      rebalanceFrequency?: "weekly" | "monthly" | "quarterly";
      requiredPlan?: "free" | "premium";
    },
  ) {
    return prisma.finuerBasket.update({
      where: { id },
      data: {
        ...(data.basketName !== undefined ? { basketName: data.basketName.trim() } : {}),
        ...(data.shortDescription !== undefined
          ? { shortDescription: data.shortDescription?.trim() || null }
          : {}),
        ...(data.methodology !== undefined ? { methodology: data.methodology?.trim() || null } : {}),
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
      include: basketIncludeDetail,
    });
  }

  async recalculatePerformance(basketId: number) {
    await recalculateBasketPerformance(basketId);
    return this.findBasketById(basketId, true);
  }

  async validateAndRecalculate(basketId: number) {
    const stocks = await this.listBasketStocks(basketId);
    validateBasketWeights(stocks.map((s) => toNumber(s.weightPct)));
    return this.recalculatePerformance(basketId);
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
    const search = searchParams.get("search") || searchParams.get("q");
    return {
      marketId: Number.isFinite(marketId) && marketId > 0 ? marketId : null,
      typeId: Number.isFinite(typeId) && typeId > 0 ? typeId : null,
      timePeriod: parseTimePeriod(searchParams.get("time_period")),
      sortOrder: parseSortOrder(searchParams.get("sort_order")),
      search: search?.trim() || null,
    };
  }

  getSortField(timePeriod: FinuerBasketTimePeriod) {
    return getReturnField(timePeriod);
  }
}

export const finuerBasketRepository = new FinuerBasketRepository();
