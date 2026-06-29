import { MARKET_INSTRUMENTS, resolveMarketExchange } from "@/lib/angelone-shared";

export type MarketSearchHit = {
  exchange: string;
  tradingSymbol: string;
  symbolName: string;
  instrumentType: string;
  token: string;
  display: string;
};

export type SearchCategory = "stocks" | "mutualFunds" | "options" | "futures";

export const SEARCH_CATEGORY_LABELS: Record<SearchCategory, string> = {
  stocks: "Stocks",
  mutualFunds: "Mutual Funds",
  options: "Options",
  futures: "Futures",
};

export const SEARCH_CATEGORY_ORDER: SearchCategory[] = [
  "stocks",
  "mutualFunds",
  "options",
  "futures",
];

/** Popular NSE equities for the empty-state trending list (no indices). */
export const TRENDING_STOCKS: MarketSearchHit[] = MARKET_INSTRUMENTS.filter(
  (m) => !m.token.startsWith("999"),
).map((m) => ({
  exchange: m.exchange,
  tradingSymbol: m.symbol.endsWith("-EQ") ? m.symbol : `${m.symbol}-EQ`,
  symbolName: m.symbol,
  instrumentType: "EQ",
  token: m.token,
  display: m.symbol,
}));

export function displaySymbolName(row: {
  symbolName: string;
  tradingSymbol: string;
  instrumentType?: string;
}): string {
  const raw = (row.symbolName || row.tradingSymbol).replace(/-EQ$/i, "").trim();
  if (row.instrumentType === "EQ" || row.tradingSymbol.endsWith("-EQ")) {
    return raw.split("-")[0].toUpperCase();
  }
  return raw;
}

export function normalizeMarketSearchRow(row: {
  exchange: string;
  tradingSymbol: string;
  symbolName: string;
  instrumentType?: string;
  token: string;
}): MarketSearchHit {
  const instrumentType = row.instrumentType || "EQ";
  const exchange = resolveMarketExchange({
    exchange: row.exchange,
    symboltoken: row.token,
    tradingSymbol: row.tradingSymbol,
    instrumentType,
  });
  return {
    exchange,
    tradingSymbol: row.tradingSymbol,
    symbolName: row.symbolName,
    instrumentType,
    token: row.token,
    display: displaySymbolName({ ...row, instrumentType }),
  };
}

export function categorizeMarketHit(hit: MarketSearchHit): SearchCategory {
  const type = hit.instrumentType.toUpperCase();
  const sym = hit.tradingSymbol.toUpperCase();
  const name = (hit.symbolName || "").toUpperCase();

  if (
    type === "MF" ||
    type === "MUTUALFUND" ||
    type === "MUTUAL_FUND" ||
    sym.includes("MF") ||
    name.includes("MUTUAL FUND") ||
    name.includes("ETF")
  ) {
    return "mutualFunds";
  }
  if (type === "OPT" || sym.endsWith("CE") || sym.endsWith("PE")) return "options";
  if (type === "FUT" || sym.includes("FUT")) return "futures";
  return "stocks";
}

export function groupMarketHits(hits: MarketSearchHit[]): Record<SearchCategory, MarketSearchHit[]> {
  const grouped: Record<SearchCategory, MarketSearchHit[]> = {
    stocks: [],
    mutualFunds: [],
    options: [],
    futures: [],
  };
  for (const hit of hits) {
    grouped[categorizeMarketHit(hit)].push(hit);
  }
  return grouped;
}

export function chartHref(hit: MarketSearchHit): string {
  const params = new URLSearchParams({
    symbol: hit.display,
    token: hit.token,
    exchange: hit.exchange,
    type: hit.instrumentType || "EQ",
  });
  return `/user/markets/chart?${params.toString()}`;
}
