import type {
  CompetitionHolding,
  CompetitionOrder,
  CompetitionPortfolio,
  CompetitionTransactionType,
} from "@prisma/client";

export const COMPETITION_DEFAULT_INITIAL_CAPITAL = 1_000_000;

export type BuySellInput = {
  stockSymbol: string;
  companyName: string;
  quantity: number;
  price: number;
  exchange?: string;
  symbolToken?: string;
};

export function calcTotalReturn(initialCapital: number, portfolioValue: number): number {
  if (initialCapital <= 0) return 0;
  return ((portfolioValue - initialCapital) / initialCapital) * 100;
}

export function calcHoldingMetrics(
  quantity: number,
  avgBuyPrice: number,
  currentPrice: number,
) {
  const investedAmount = quantity * avgBuyPrice;
  const marketValue = quantity * currentPrice;
  const pnl = marketValue - investedAmount;
  const pnlPercentage = investedAmount > 0 ? (pnl / investedAmount) * 100 : 0;
  return { investedAmount, marketValue, pnl, pnlPercentage };
}

export function serializePortfolio(p: CompetitionPortfolio) {
  const initial = Number(p.initialCapital);
  const value = Number(p.portfolioValue);
  return {
    id: p.id,
    competitionId: p.competitionId,
    userId: p.userId,
    initialCapital: initial,
    cashBalance: Number(p.cashBalance),
    investedAmount: Number(p.investedAmount),
    portfolioValue: value,
    totalReturn: Number(p.totalReturn),
    todayReturn: Number(p.todayReturn),
    rank: p.rank,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    totalReturnPct: Number(p.totalReturn),
    displayInitialCapital: formatINR(initial),
    displayPortfolioValue: formatINR(value),
  };
}

export function serializeHolding(h: CompetitionHolding) {
  return {
    id: h.id,
    stockSymbol: h.stockSymbol,
    companyName: h.companyName,
    exchange: h.exchange,
    quantity: h.quantity,
    avgBuyPrice: Number(h.avgBuyPrice),
    currentPrice: Number(h.currentPrice),
    investedAmount: Number(h.investedAmount),
    marketValue: Number(h.marketValue),
    pnl: Number(h.pnl),
    pnlPercentage: Number(h.pnlPercentage),
    updatedAt: h.updatedAt.toISOString(),
  };
}

export function serializeOrder(o: CompetitionOrder) {
  return {
    id: o.id,
    stockSymbol: o.stockSymbol,
    companyName: o.companyName,
    transactionType: o.transactionType,
    quantity: o.quantity,
    price: Number(o.price),
    totalAmount: Number(o.totalAmount),
    orderTime: o.orderTime.toISOString(),
  };
}

export function formatINR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export const COMPETITION_TRADING_API_DOCS = {
  buy: "POST /api/v1/competitions/:id/buy { stockSymbol, companyName, quantity, price, exchange?, symbolToken? }",
  sell: "POST /api/v1/competitions/:id/sell { stockSymbol, quantity, price }",
  portfolio: "GET /api/v1/competitions/:id/portfolio",
  holdings: "GET /api/v1/competitions/:id/holdings",
  orders: "GET /api/v1/competitions/:id/orders?type=all|buy|sell",
  refresh: "POST /api/v1/competitions/:id/refresh-prices",
  participants: "GET /api/v1/competitions/:id/participants",
} as const;

export type OrderFilter = CompetitionTransactionType | "all";

export function parseOrderFilter(value: string | null): OrderFilter {
  if (value === "buy" || value === "sell") return value;
  return "all";
}
