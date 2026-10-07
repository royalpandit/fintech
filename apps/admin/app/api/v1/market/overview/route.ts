import { NextResponse } from "next/server";
import type { ExtendedQuoteData, QuoteInstrument } from "@/lib/dhan";
import { MARKET_INSTRUMENTS } from "@/lib/angelone-shared";
import { getYahooQuotes } from "@/lib/yahoo-quote";
import { FALLBACK_REFRESH_MS } from "@/lib/market-refresh";

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

type Source = "yahoo";

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
 * Yahoo needs one request per symbol rather than one batched call for the whole
 * board, so this holds a result for FALLBACK_REFRESH_MS and the client is told
 * to poll at that same cadence — the two cannot drift apart.
 */
let yahooCache: { rows: ExtendedQuoteData[]; expires: number } | null = null;

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
    // Said out loud in the UI: these are delayed third-party prices, not the
    // live exchange feed the product implies.
    ...(reason ? { degraded: true, degradedReason: reason } : {}),
    refreshMs: FALLBACK_REFRESH_MS,
    ts: Date.now(),
  });
}

/**
 * GET /api/v1/market/overview
 *
 * Indices + equities with LTP, % change and 52-week high/low, from Yahoo.
 * No credentials anywhere on this path, so there is no token to expire and
 * empty the board.
 */
export async function GET() {
  const yahoo = await yahooQuotes();
  if (yahoo) return respond(yahoo, "yahoo", "");

  return NextResponse.json(
    { ok: false, error: "Market data is briefly unavailable.", indices: [], stocks: [] },
    { status: 200 },
  );
}
