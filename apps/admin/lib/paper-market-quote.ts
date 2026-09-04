import { getOHLC, searchSymbol } from "@/lib/dhan";
import { isEquityInstrument, isIndexInstrument } from "@/lib/instrument-type";

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
  //
  // These used to compare against "EQ", which is Angel One's label. Dhan says
  // "EQUITY", so after the provider swap both equity branches stopped matching
  // and every stock fell through to results[0] — the first fuzzy `includes()`
  // hit in the scrip master. That resolves silently, so an order could be
  // priced against a different security. isEquityInstrument accepts both.
  const wanted = symbol.toUpperCase();
  const match =
    results.find(
      (r) =>
        isEquityInstrument(r.instrumentType) &&
        r.tradingSymbol.toUpperCase().replace(/-EQ$/, "") === wanted,
    ) ??
    results.find((r) => isEquityInstrument(r.instrumentType)) ??
    // Exact ticker match regardless of type, before falling back to fuzzy.
    results.find((r) => r.tradingSymbol.toUpperCase().replace(/-EQ$/, "") === wanted) ??
    results.find((r) => isIndexInstrument(r.instrumentType)) ??
    results[0];

  const resolved = { token: match.token, exchange: match.exchange };
  tokenCache.set(key, resolved);
  return resolved;
}

/**
 * Very short-lived quote cache for the order path.
 *
 * Every Dhan REST call is serialized through one global chain with an 850ms
 * minimum gap (lib/angelone-quote-coordinator.ts), so an order placed while the
 * Markets poll, a watchlist refresh or the basket sweep is queued waits behind
 * all of it before its own round trip even starts. That is the whole reason
 * placing a trade felt slow — the engine itself is fast; it was standing in
 * line for a price.
 *
 * Two seconds is deliberately tighter than anything the user is looking at: the
 * Markets page refreshes quotes every 10s, so a price this fresh is newer than
 * the one on screen when they clicked. It is short enough that a market order
 * still fills at a live price, and long enough that the common case — clicking
 * Buy on a row whose quote was just fetched — costs no network at all.
 */
const QUOTE_TTL_MS = 2_000;
const quoteCache = new Map<string, { ltp: number; at: number }>();

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

  const cacheKey = `${exchange}:${token}`;
  const hit = quoteCache.get(cacheKey);
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) return hit.ltp;

  const results = await getOHLC([{ exchange, symboltoken: token }]);
  const q = results[0];
  const ltp = q?.ltp;
  if (ltp == null || !Number.isFinite(ltp) || ltp <= 0) {
    // Nothing is cached on failure — a stale price must never fill an order.
    throw new Error(`Live price unavailable for ${input.symbol}`);
  }

  quoteCache.set(cacheKey, { ltp, at: Date.now() });
  return ltp;
}

export function normalizePaperSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().split("-")[0].replace(/\.(NS|BO)$/i, "").replace(/\s+/g, "");
}

