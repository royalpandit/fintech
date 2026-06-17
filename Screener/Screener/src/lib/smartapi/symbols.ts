import { smartApiFetch } from "./session";
import type { ResolvedSymbol, ScripSearchResult } from "./types";

const DEFAULT_SYMBOL: ResolvedSymbol = {
  exchange: "NSE",
  tradingsymbol: "RELIANCE-EQ",
  symboltoken: "2885",
  displayName: "RELIANCE",
};

export function normalizeSymbolQuery(query: string): string {
  return query
    .trim()
    .toUpperCase()
    .replace(/^NSE:/, "")
    .replace(/-EQ$/, "")
    .split(/[,\s]+/)[0];
}

function mapSearchResult(r: ScripSearchResult): ResolvedSymbol {
  return {
    exchange: r.exchange,
    tradingsymbol: r.tradingsymbol,
    symboltoken: String(r.symboltoken),
    displayName: r.tradingsymbol.replace(/-EQ$/, ""),
  };
}

export async function searchNseEquity(
  query: string,
): Promise<ResolvedSymbol[]> {
  const searchscrip = normalizeSymbolQuery(query);
  if (!searchscrip) return [DEFAULT_SYMBOL];

  const results = await smartApiFetch<ScripSearchResult[]>(
    "/rest/secure/angelbroking/order/v1/searchScrip",
    {
      method: "POST",
      body: { exchange: "NSE", searchscrip },
    },
  );

  const seen = new Set<string>();

  return results
    .filter((r) => r.tradingsymbol.endsWith("-EQ"))
    .filter((r) => {
      if (seen.has(r.tradingsymbol)) return false;
      seen.add(r.tradingsymbol);
      return true;
    })
    .slice(0, 12)
    .map(mapSearchResult);
}

export async function resolveSymbol(query: string): Promise<ResolvedSymbol> {
  const normalized = normalizeSymbolQuery(query);
  if (!normalized) return DEFAULT_SYMBOL;

  const matches = await searchNseEquity(normalized);
  const exact = matches.find((m) => m.displayName === normalized);
  return exact ?? matches[0] ?? DEFAULT_SYMBOL;
}

export { DEFAULT_SYMBOL };
