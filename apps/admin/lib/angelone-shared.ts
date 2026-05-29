/**
 * Client-safe Angel One helpers (no Node / SmartAPI imports).
 * Use this from `"use client"` components instead of `@/lib/angelone`.
 */

export function resolveMarketExchange(input: {
  exchange: string;
  symboltoken: string;
  tradingSymbol?: string;
  instrumentType?: string;
}): string {
  const sym = (input.tradingSymbol ?? "").toUpperCase();
  const exch = (input.exchange ?? "NSE").toUpperCase();
  if (sym.endsWith("-EQ") || sym.endsWith("-BE") || input.instrumentType === "EQ") {
    if (exch === "BSE" || input.symboltoken === "99919000" || sym.includes("SENSEX")) return "BSE";
    return "NSE";
  }
  if (sym.endsWith("CE") || sym.endsWith("PE") || input.instrumentType === "OPT") return "NFO";
  if (sym.includes("FUT") || input.instrumentType === "FUT") return "NFO";
  if (input.symboltoken === "99919000" || sym.includes("SENSEX")) return "BSE";
  if (exch === "BSE") return "BSE";
  if (exch === "MCX" || exch === "NCDEX") return exch;
  return "NSE";
}

export function optionChainExchange(underlying: string): string {
  return underlying.toUpperCase() === "SENSEX" ? "BFO" : "NFO";
}

export function optionUnderlyingKey(tradingSymbol: string, display: string): string | null {
  const sym = tradingSymbol.toUpperCase();
  const name = display.toUpperCase();
  if (sym.endsWith("CE") || sym.endsWith("PE")) return null;
  if (name.includes("BANK") && (name.includes("NIFTY") || sym.includes("BANKNIFTY"))) return "BANKNIFTY";
  if (name.includes("NIFTY 50") || sym === "NIFTY 50" || sym === "NIFTY") return "NIFTY";
  if (name.includes("SENSEX") || sym.includes("SENSEX")) return "SENSEX";
  if (sym.endsWith("-EQ")) return sym.replace(/-EQ$/, "");
  return sym.split("-")[0] || null;
}

export function formatExpiryLabel(code: string): string {
  const m = code.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if (!m) return code;
  return `${m[1]} ${m[2]} 20${m[3]}`;
}

export const MARKET_INSTRUMENTS = [
  { symbol: "NIFTY 50",   token: "99926000", exchange: "NSE" },
  { symbol: "SENSEX",     token: "99919000", exchange: "BSE" },
  { symbol: "NIFTY BANK", token: "99926009", exchange: "NSE" },
  { symbol: "RELIANCE",   token: "2885",     exchange: "NSE" },
  { symbol: "TCS",        token: "11536",    exchange: "NSE" },
  { symbol: "HDFCBANK",   token: "1333",     exchange: "NSE" },
  { symbol: "INFY",       token: "1594",     exchange: "NSE" },
  { symbol: "ICICIBANK",  token: "4963",     exchange: "NSE" },
  { symbol: "WIPRO",      token: "3787",     exchange: "NSE" },
  { symbol: "SBIN",       token: "3045",     exchange: "NSE" },
  { symbol: "BAJFINANCE", token: "317",      exchange: "NSE" },
  { symbol: "BHARTIARTL", token: "10604",    exchange: "NSE" },
  { symbol: "LT",         token: "11483",    exchange: "NSE" },
] as const;

export type KnownSymbol = (typeof MARKET_INSTRUMENTS)[number]["symbol"];
