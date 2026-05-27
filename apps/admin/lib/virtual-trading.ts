export type VirtualTradeRow = {
  id?: number;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  tradedAt: Date;
};

export type VirtualPosition = {
  symbol: string;
  quantity: number;
  avgPrice: number;
  costBasis: number;
  lastPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
};

export type TradeWithPnL = VirtualTradeRow & {
  id: number;
  value: number;
  realizedPnL: number | null;
};

export type VirtualPortfolioSummary = {
  cashBalance: number;
  investedCost: number;
  holdingsValue: number;
  totalEquity: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  totalPnLPct: number;
  openPositions: number;
  totalTrades: number;
};

/** Build open positions from trade history (FIFO avg cost on buys). */
export function computePositions(
  trades: VirtualTradeRow[],
  priceBySymbol: Record<string, number> = {},
): VirtualPosition[] {
  const positions: Record<string, { quantity: number; avgPrice: number }> = {};

  for (const t of [...trades].sort((a, b) => a.tradedAt.getTime() - b.tradedAt.getTime())) {
    const key = t.symbol.toUpperCase();
    if (!positions[key]) positions[key] = { quantity: 0, avgPrice: 0 };
    const pos = positions[key];
    const qty = t.quantity;
    const price = t.price;

    if (t.side === "buy") {
      const totalCost = pos.avgPrice * pos.quantity + price * qty;
      pos.quantity += qty;
      pos.avgPrice = pos.quantity > 0 ? totalCost / pos.quantity : 0;
    } else {
      pos.quantity -= qty;
      if (pos.quantity <= 0) {
        pos.quantity = 0;
        pos.avgPrice = 0;
      }
    }
  }

  return Object.entries(positions)
    .filter(([, p]) => p.quantity > 0)
    .map(([symbol, p]) => {
      const lastPrice = priceBySymbol[symbol] ?? p.avgPrice;
      const costBasis = p.avgPrice * p.quantity;
      const marketValue = lastPrice * p.quantity;
      const unrealizedPnL = marketValue - costBasis;
      const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
      return {
        symbol,
        quantity: p.quantity,
        avgPrice: p.avgPrice,
        costBasis,
        lastPrice,
        marketValue,
        unrealizedPnL,
        unrealizedPnLPct,
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);
}

/** Realized P&L per sell trade (avg-cost method). */
export function attachRealizedPnL(
  trades: (VirtualTradeRow & { id: number })[],
): TradeWithPnL[] {
  const positions: Record<string, { quantity: number; avgPrice: number }> = {};

  const sorted = [...trades].sort((a, b) => a.tradedAt.getTime() - b.tradedAt.getTime());

  return sorted.map((t) => {
    const key = t.symbol.toUpperCase();
    if (!positions[key]) positions[key] = { quantity: 0, avgPrice: 0 };
    const pos = positions[key];
    const value = t.quantity * t.price;
    let realizedPnL: number | null = null;

    if (t.side === "buy") {
      const totalCost = pos.avgPrice * pos.quantity + t.price * t.quantity;
      pos.quantity += t.quantity;
      pos.avgPrice = pos.quantity > 0 ? totalCost / pos.quantity : 0;
    } else {
      realizedPnL = (t.price - pos.avgPrice) * t.quantity;
      pos.quantity -= t.quantity;
      if (pos.quantity <= 0) {
        pos.quantity = 0;
        pos.avgPrice = 0;
      }
    }

    return { ...t, symbol: key, value, realizedPnL };
  });
}

export function computePortfolioSummary(
  cashBalance: number,
  trades: VirtualTradeRow[],
  priceBySymbol: Record<string, number> = {},
  initialDeposit = 0,
): VirtualPortfolioSummary {
  const positions = computePositions(trades, priceBySymbol);
  const investedCost = positions.reduce((s, p) => s + p.costBasis, 0);
  const holdingsValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const totalEquity = cashBalance + holdingsValue;

  const withPnL = attachRealizedPnL(
    trades
      .filter((t) => t.id != null)
      .map((t) => ({ ...t, id: t.id as number })),
  );
  const realizedPnL = withPnL
    .filter((t) => t.side === "sell" && t.realizedPnL != null)
    .reduce((s, t) => s + (t.realizedPnL ?? 0), 0);
  const unrealizedPnL = positions.reduce((s, p) => s + p.unrealizedPnL, 0);
  const totalPnL = realizedPnL + unrealizedPnL;

  const baseline =
    initialDeposit > 0
      ? initialDeposit
      : trades.length === 0
        ? cashBalance || 1
        : Math.max(cashBalance + investedCost, 1);

  return {
    cashBalance,
    investedCost,
    holdingsValue,
    totalEquity,
    realizedPnL,
    unrealizedPnL,
    totalPnL,
    totalPnLPct: baseline > 0 ? (totalPnL / baseline) * 100 : 0,
    openPositions: positions.length,
    totalTrades: trades.length,
  };
}

/** Last trade price per symbol (fallback mark). */
export function lastPricesFromTrades(trades: VirtualTradeRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of [...trades].sort((a, b) => a.tradedAt.getTime() - b.tradedAt.getTime())) {
    map[t.symbol.toUpperCase()] = t.price;
  }
  return map;
}

export function getSellableQuantity(symbol: string, trades: VirtualTradeRow[]): number {
  const positions = computePositions(trades);
  const pos = positions.find((p) => p.symbol === symbol.toUpperCase());
  return pos?.quantity ?? 0;
}

export function filterTradesByPeriod(
  trades: VirtualTradeRow[],
  opts: { from?: Date; to?: Date; month?: string },
): VirtualTradeRow[] {
  let from = opts.from;
  let to = opts.to;

  if (opts.month && /^\d{4}-\d{2}$/.test(opts.month)) {
    const [y, m] = opts.month.split("-").map(Number);
    from = new Date(y, m - 1, 1);
    to = new Date(y, m, 0, 23, 59, 59, 999);
  }

  return trades.filter((t) => {
    const ts = t.tradedAt.getTime();
    if (from && ts < from.getTime()) return false;
    if (to && ts > to.getTime()) return false;
    return true;
  });
}
