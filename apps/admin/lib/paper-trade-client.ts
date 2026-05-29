/** Client helpers for paper (virtual) broker-style orders */

export function paperSymbolFromWatchlist(item: {
  display: string;
  tradingSymbol: string;
}): string {
  const raw = (item.tradingSymbol || item.display).trim().toUpperCase();
  return raw.split("-")[0].replace(/\.(NS|BO)$/i, "").replace(/\s+/g, "");
}

export type PaperOrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";

export type PaperOrderRow = {
  id: number;
  symbol: string;
  side: string;
  order_type: string;
  product: string;
  quantity: number;
  limit_price: number | null;
  trigger_price: number | null;
  execution_price: number | null;
  status: string;
  reject_reason: string | null;
  created_at: string;
  executed_at: string | null;
};

export type PaperOrderResult = {
  ok: boolean;
  text: string;
  balance?: number;
  executed?: boolean;
  order?: PaperOrderRow;
};

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text.trim()) throw new Error(`Empty response (${res.status})`);
  return JSON.parse(text) as {
    status?: boolean;
    error?: string;
    order?: PaperOrderRow;
    executed?: boolean;
    execution_price?: number | null;
    message?: string;
    new_balance?: number | null;
  };
}

export async function ensurePaperWallet(): Promise<void> {
  const res = await fetch("/api/v1/lab/create", { method: "POST", credentials: "include" });
  const json = await parseJson(res);
  if (!res.ok && json.status === false) {
    throw new Error(json.error || "Could not open paper wallet");
  }
}

export async function placePaperOrder(params: {
  symbol: string;
  side: "buy" | "sell";
  orderType: PaperOrderType;
  quantity: number;
  limitPrice?: number;
  triggerPrice?: number;
  product?: string;
  token?: string;
  exchange?: string;
  tradingSymbol?: string;
}): Promise<PaperOrderResult> {
  await ensurePaperWallet();

  const res = await fetch("/api/v1/lab/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      symbol: params.symbol.toUpperCase(),
      side: params.side,
      orderType: params.orderType,
      quantity: params.quantity,
      limitPrice: params.limitPrice,
      triggerPrice: params.triggerPrice,
      product: params.product ?? "CNC",
      token: params.token,
      exchange: params.exchange,
      tradingSymbol: params.tradingSymbol,
    }),
  });
  const json = await parseJson(res);

  if (!res.ok || json.status === false) {
    return { ok: false, text: json.error || "Order failed" };
  }

  const bal = json.new_balance != null ? Number(json.new_balance) : undefined;
  return {
    ok: true,
    text: json.message || (json.executed ? "Order executed" : "Order placed"),
    balance: bal,
    executed: json.executed,
    order: json.order,
  };
}

/** @deprecated Use placePaperOrder with orderType MARKET */
export async function placePaperTrade(params: {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  token?: string;
  exchange?: string;
  tradingSymbol?: string;
}): Promise<PaperOrderResult> {
  return placePaperOrder({
    ...params,
    orderType: "MARKET",
    token: params.token,
    exchange: params.exchange,
    tradingSymbol: params.tradingSymbol,
  });
}

export async function fetchPaperOrders(status?: string): Promise<PaperOrderRow[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`/api/v1/lab/orders${q}`, { credentials: "include", cache: "no-store" });
  const json = await parseJson(res);
  if (!res.ok || json.status === false) return [];
  return (json as { orders?: PaperOrderRow[] }).orders ?? [];
}

export async function cancelPaperOrder(orderId: number): Promise<boolean> {
  const res = await fetch(`/api/v1/lab/orders/${orderId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const json = await parseJson(res);
  return res.ok && json.status !== false;
}

export async function matchPendingPaperOrders(
  quotes: { symbol: string; ltp: number }[],
): Promise<number> {
  if (!quotes.length) return 0;
  const res = await fetch("/api/v1/lab/orders", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ quotes }),
  });
  const json = await parseJson(res);
  if (!res.ok) return 0;
  return (json as { matched?: number }).matched ?? 0;
}

export type PaperTradeRow = {
  id: number;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  realized_pnl?: number | null;
  traded_at: string;
};

export async function fetchPaperTrades(limit = 100): Promise<PaperTradeRow[]> {
  const res = await fetch(`/api/v1/lab/trades?limit=${limit}`, { credentials: "include" });
  const json = await parseJson(res);
  if (!res.ok || !Array.isArray((json as { trades?: PaperTradeRow[] }).trades)) return [];
  return (json as { trades: PaperTradeRow[] }).trades;
}

export async function fetchTodayPaperTrades(): Promise<PaperTradeRow[]> {
  const trades = await fetchPaperTrades(200);
  const today = new Date().toISOString().slice(0, 10);
  return trades.filter(t => t.traded_at?.slice(0, 10) === today);
}

export type PaperPortfolioSummary = {
  cash_balance: number;
  holdings_value: number;
  total_equity: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
};

export type PaperPosition = {
  symbol: string;
  quantity: number;
  avg_price: number;
  last_price: number;
  cost_basis: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
};

export async function fetchPaperSummary(
  quotes?: { symbol: string; ltp: number }[],
): Promise<{ summary: PaperPortfolioSummary | null; positions: PaperPosition[] }> {
  const quotesParam =
    quotes?.length ? `?quotes=${encodeURIComponent(JSON.stringify(quotes))}` : "";
  const res = await fetch(`/api/v1/lab/summary${quotesParam}`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = await parseJson(res);
  if (!res.ok || !(json as { has_wallet?: boolean }).has_wallet) {
    return { summary: null, positions: [] };
  }
  const j = json as {
    summary: PaperPortfolioSummary;
    positions: PaperPosition[];
  };
  return { summary: j.summary, positions: j.positions ?? [] };
}
