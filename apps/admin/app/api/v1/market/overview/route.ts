import { NextResponse } from "next/server";
import { getExtendedQuotes, type ExtendedQuoteData, type QuoteInstrument } from "@/lib/dhan";
import { MARKET_INSTRUMENTS } from "@/lib/angelone-shared";
import { handleRateLimitMessage, isRateLimited, withMarketCache } from "@/lib/market-rate-limit";
import { getYahooQuotes } from "@/lib/yahoo-quote";
import { FALLBACK_REFRESH_MS, quoteRefreshMs } from "@/lib/market-refresh";

export const dynamic = "force-dynamic";

export type OverviewRow = {
  symbol: string;
  token: string;
  exchange: string;
  type: "INDEX" | "EQ";
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  netChange: number;
  percentChange: number;
  week52High: number | null;
  week52Low: number | null;
};

type Source = "dhan" | "yahoo";

const INSTRUMENTS: (QuoteInstrument & { tradingSymbol: string })[] = MARKET_INSTRUMENTS.map((m) => ({
  exchange: m.exchange,
  symboltoken: m.token,
  tradingSymbol: m.symbol,
}));

function byToken(rows: ExtendedQuoteData[]): Map<string, ExtendedQuoteData> {
  const merged = new Map<string, ExtendedQuoteData>();
  for (const q of rows) merged.set(q.symbolToken, q);
  return merged;
}

/*
 * Yahoo gets its own cache, deliberately not withMarketCache.
 *
 * That helper throws the moment Dhan is rate-limited — which is one of the
 * exact situations this path exists to survive. Its TTL is also longer:
 * Dhan answers the whole board in a single batched request, while Yahoo needs
 * one request per symbol, so the standby feed runs at a slower tick on purpose.
 */
let yahooCache: { rows: ExtendedQuoteData[]; expires: number } | null = null;

/*
 * Stop re-trying a credential we know is dead.
 *
 * An expired DHAN_ACCESS_TOKEN fails the same way every time, and at a
 * three-second poll that is a doomed round trip to Dhan twenty times a minute,
 * each one delaying the standby data behind it. Auth failures only — a
 * timeout or a 5xx is transient and deserves the next attempt.
 *
 * The window is deliberately short, and the token is read from the environment
 * at boot, so the restart needed to install a new one also clears this.
 */
const AUTH_COOLDOWN_MS = 30_000;
let dhanBlockedUntil = 0;

function isAuthFailure(msg: string): boolean {
  return /HTTP 401|HTTP 403|"808"|authentication failed|invalid token/i.test(msg);
}

async function yahooQuotes(): Promise<Map<string, ExtendedQuoteData> | null> {
  try {
    if (!yahooCache || yahooCache.expires <= Date.now()) {
      yahooCache = {
        rows: await getYahooQuotes(INSTRUMENTS),
        expires: Date.now() + FALLBACK_REFRESH_MS,
      };
    }
    return byToken(yahooCache.rows);
  } catch {
    return null;
  }
}

function respond(quotes: Map<string, ExtendedQuoteData>, source: Source, reason: string) {
  const rows: OverviewRow[] = MARKET_INSTRUMENTS.map((m) => {
    const q = quotes.get(m.token);
    const isIndex = m.exchange === "IDX_I";
    return {
      symbol: m.symbol,
      token: m.token,
      exchange: m.exchange,
      type: isIndex ? "INDEX" : "EQ",
      ltp: q ? Number(q.ltp) || 0 : 0,
      open: q ? Number(q.open) || 0 : 0,
      high: q ? Number(q.high) || 0 : 0,
      low: q ? Number(q.low) || 0 : 0,
      close: q ? Number(q.close) || 0 : 0,
      netChange: q ? Number(q.netChange) || 0 : 0,
      percentChange: q ? Number(q.percentChange) || 0 : 0,
      week52High: q?.week52High != null ? Number(q.week52High) : null,
      week52Low: q?.week52Low != null ? Number(q.week52Low) : null,
    };
  });

  return NextResponse.json({
    ok: true,
    indices: rows.filter((r) => r.type === "INDEX"),
    stocks: rows.filter((r) => r.type === "EQ"),
    source,
    // Said out loud in the UI: on the standby feed these are delayed
    // third-party prices, not the live exchange feed the product implies.
    ...(source === "yahoo" ? { degraded: true, degradedReason: reason } : {}),
    // The client polls at whatever cadence produced this payload, so the two
    // cannot drift apart.
    refreshMs: source === "yahoo" ? FALLBACK_REFRESH_MS : quoteRefreshMs(),
    ts: Date.now(),
  });
}

/**
 * GET /api/v1/market/overview
 *
 * Indices + equities with LTP, % change and 52-week high/low. Dhan is the
 * primary feed; Yahoo stands behind it so an expired Dhan token degrades the
 * board to delayed prices instead of emptying it.
 */
export async function GET() {
  // A live rate-limit block is a reason to use the standby feed, not a reason
  // to return an empty board.
  if (isRateLimited()) {
    const fallback = await yahooQuotes();
    return fallback
      ? respond(fallback, "yahoo", "Dhan rate limit")
      : NextResponse.json({ ok: false, rateLimited: true, indices: [], stocks: [] });
  }

  if (Date.now() < dhanBlockedUntil) {
    const fallback = await yahooQuotes();
    if (fallback) return respond(fallback, "yahoo", "Dhan credentials rejected");
    // Standby is down too — let Dhan be retried rather than serving nothing.
    dhanBlockedUntil = 0;
  }

  try {
    const quotes = await withMarketCache("overview:full", quoteRefreshMs(), async () =>
      byToken(await getExtendedQuotes(INSTRUMENTS)),
    );
    // Dhan can answer 200 with nothing usable, so an empty board counts as a
    // failure and falls through to the standby feed rather than rendering
    // thirteen rows of zeroes.
    if (quotes.size === 0) throw new Error("Dhan returned no quotes");
    return respond(quotes, "dhan", "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    handleRateLimitMessage(msg);
    if (isAuthFailure(msg)) {
      dhanBlockedUntil = Date.now() + AUTH_COOLDOWN_MS;
      console.error(
        "[/api/v1/market/overview] Dhan auth rejected — check DHAN_ACCESS_TOKEN " +
          `(it expires daily). Serving Yahoo for ${AUTH_COOLDOWN_MS / 1000}s. ${msg}`,
      );
    } else {
      console.error("[/api/v1/market/overview] Dhan failed, trying Yahoo:", msg);
    }

    const fallback = await yahooQuotes();
    return fallback
      ? respond(fallback, "yahoo", msg)
      : NextResponse.json({ ok: false, error: msg, indices: [], stocks: [] }, { status: 200 });
  }
}
