/** Client helpers for paper (virtual) orders from Markets UI */

export function paperSymbolFromWatchlist(item: {
  display: string;
  tradingSymbol: string;
}): string {
  const raw = (item.tradingSymbol || item.display).trim().toUpperCase();
  return raw.split("-")[0].replace(/\.(NS|BO)$/i, "").replace(/\s+/g, "");
}

export async function ensurePaperWallet(): Promise<void> {
  const res = await fetch("/api/v1/lab/create", { method: "POST" });
  const json = await res.json();
  if (!res.ok && json.status === false) {
    throw new Error(json.error || "Could not open paper wallet");
  }
}

export type PaperOrderResult = {
  ok: boolean;
  text: string;
  balance?: number;
};

export async function placePaperTrade(params: {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
}): Promise<PaperOrderResult> {
  await ensurePaperWallet();

  const res = await fetch("/api/v1/lab/trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol: params.symbol.toUpperCase(),
      side: params.side,
      quantity: params.quantity,
      price: params.price,
    }),
  });
  const json = await res.json();

  if (!res.ok || json.status === false) {
    return { ok: false, text: json.error || "Paper order failed" };
  }

  const bal = Number(json.new_balance);
  const sideLabel = params.side.toUpperCase();
  return {
    ok: true,
    text: `Paper ${sideLabel} filled — ${params.quantity} × ${params.symbol} @ ₹${params.price.toLocaleString("en-IN")}. Balance ₹${bal.toLocaleString("en-IN")}`,
    balance: bal,
  };
}

export type PaperTradeRow = {
  id: number;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  traded_at: string;
};

export async function fetchTodayPaperTrades(): Promise<PaperTradeRow[]> {
  const res = await fetch("/api/v1/lab/trades?limit=100");
  const json = await res.json();
  if (!res.ok || json.status === false || !Array.isArray(json.trades)) return [];

  const today = new Date().toISOString().slice(0, 10);
  return json.trades.filter((t: PaperTradeRow) => t.traded_at?.slice(0, 10) === today);
}
