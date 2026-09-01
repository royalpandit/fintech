import { getOHLC, searchSymbol } from "@/lib/dhan";

export type QuoteInput = {
  symbol: string;
  token?: string | null;
  exchange?: string | null;
  tradingSymbol?: string | null;
};

// Symbol → token lookups hit AngelOne's searchScrip endpoint, which is slow and
// rate-limited. Tokens are stable for the life of the process, so cache them.
const tokenCache = new Map<string, { token: string; exchange: string }>();

/**
 * Resolve a plain symbol ("RELIANCE") to its AngelOne market-data token.
 * Order entry points that only know a ticker — the paper trade form lets the
 * user type one freehand — have no token to pass, and orders used to be
 * rejected outright rather than looking one up.
 */
async function resolveToken(
  symbol: string,
  exchange: string,
): Promise<{ token: string; exchange: string } | null> {
  const key = `${exchange}:${symbol}`;
  const cached = tokenCache.get(key);
  if (cached) return cached;

  const results = await searchSymbol(exchange, symbol);
  if (!results.length) return null;

  // Prefer the cash-market line for the exact ticker (RELIANCE-EQ) over
  // derivatives that also match the query (RELIANCE25AUGFUT, ...CE/PE).
  const wanted = symbol.toUpperCase();
  const match =
    results.find(
      (r) => r.instrumentType === "EQ" && r.tradingSymbol.toUpperCase().replace(/-EQ$/, "") === wanted,
    ) ??
    results.find((r) => r.instrumentType === "EQ") ??
    results.find((r) => r.instrumentType === "INDEX") ??
    results[0];

  const resolved = { token: match.token, exchange: match.exchange };
  tokenCache.set(key, resolved);
  return resolved;
}

/** Fetch live LTP for a single instrument (server-side). */
export async function fetchLiveLtp(input: QuoteInput): Promise<number> {
  const symbol = normalizePaperSymbol(input.symbol);
  let token = input.token?.trim() || "";
  let exchange = (input.exchange || "NSE").toUpperCase();

  if (!token) {
    const resolved = await resolveToken(symbol, exchange);
    if (!resolved) {
      throw new Error(`Unknown symbol "${input.symbol}" — pick one from search`);
    }
    token = resolved.token;
    exchange = resolved.exchange;
  }

  const results = await getOHLC([{ exchange, symboltoken: token }]);
  const q = results[0];
  const ltp = q?.ltp;
  if (ltp == null || !Number.isFinite(ltp) || ltp <= 0) {
    throw new Error(`Live price unavailable for ${input.symbol}`);
  }
  return ltp;
}

export function normalizePaperSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().split("-")[0].replace(/\.(NS|BO)$/i, "").replace(/\s+/g, "");
}

