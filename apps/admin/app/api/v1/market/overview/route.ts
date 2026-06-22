import { NextResponse } from "next/server";
import { getExtendedQuotes, type ExtendedQuote } from "@/lib/angelone";
import { MARKET_INSTRUMENTS } from "@/lib/angelone-shared";
import { handleRateLimitMessage, isRateLimited, withMarketCache } from "@/lib/market-rate-limit";

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

/**
 * GET /api/v1/market/overview
 * MoneyControl-style snapshot: indices + equities with LTP, % change and
 * 52-week high/low (FULL quote mode). Cached briefly to respect rate limits.
 */
export async function GET() {
  if (isRateLimited()) {
    return NextResponse.json({ ok: false, rateLimited: true, indices: [], stocks: [] });
  }

  try {
    const byExchange = MARKET_INSTRUMENTS.reduce<Record<string, string[]>>((acc, m) => {
      (acc[m.exchange] ||= []).push(m.token);
      return acc;
    }, {});

    const quoteMap = await withMarketCache("overview:full", 10_000, async () => {
      const merged = new Map<string, ExtendedQuote>();
      for (const [exch, tokens] of Object.entries(byExchange)) {
        const m = await getExtendedQuotes(exch, tokens, "FULL");
        m.forEach((q, tok) => merged.set(tok, q));
      }
      return merged;
    });

    const rows: OverviewRow[] = MARKET_INSTRUMENTS.map((m) => {
      const q = quoteMap.get(m.token);
      const isIndex = m.token.startsWith("999");
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
      ts: Date.now(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    handleRateLimitMessage(msg);
    console.error("[/api/v1/market/overview]", msg);
    return NextResponse.json({ ok: false, error: msg, indices: [], stocks: [] }, { status: 200 });
  }
}
