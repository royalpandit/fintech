import { NextResponse, type NextRequest } from "next/server";
import { getLTP, MARKET_INSTRUMENTS, type QuoteInstrument } from "@/lib/angelone";
import { handleRateLimitMessage, isRateLimited, withMarketCache } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/market/live
 * Returns live OHLC + LTP for preset instruments plus any extras.
 * ?extra=TOKEN:EXCHANGE:SYMBOL:TYPE,...  — symbols added via search
 */
export async function GET(req: NextRequest) {
  try {
    if (isRateLimited()) {
      return NextResponse.json({
        ok: false,
        error: "Angel One rate limit — live quotes paused.",
        rateLimited: true,
        data: [],
      });
    }

    const { searchParams } = new URL(req.url);
    const extraParam = searchParams.get("extra") ?? "";

    const extraInstruments: QuoteInstrument[] = extraParam
      ? extraParam.split(",").flatMap(t => {
          const parts = t.split(":");
          const [tok, exch, sym, typ] = parts;
          return tok && exch && sym
            ? [{
                symboltoken: tok,
                exchange: exch,
                tradingSymbol: decodeURIComponent(sym),
                instrumentType: typ ? decodeURIComponent(typ) : undefined,
              }]
            : [];
        })
      : [];

    const seen = new Set<string>(MARKET_INSTRUMENTS.map(m => m.token));
    const all: QuoteInstrument[] = [
      ...MARKET_INSTRUMENTS.map(m => ({
        exchange: m.exchange,
        symboltoken: m.token,
        tradingSymbol: m.symbol,
        instrumentType: m.token.startsWith("999") ? "INDEX" : "EQ",
      })),
      ...extraInstruments.filter(e => !seen.has(e.symboltoken)),
    ];

    const cacheKey = `live:${all.map(i => `${i.exchange}:${i.symboltoken}`).sort().join(",")}`;
    const quotes = await withMarketCache(cacheKey, 4_000, () => getLTP(all));

    const symMap: Record<string, string> = Object.fromEntries(MARKET_INSTRUMENTS.map(m => [m.token, m.symbol]));
    const enriched = quotes.map(q => ({ ...q, displaySymbol: symMap[q.symbolToken] ?? q.tradingSymbol }));

    return NextResponse.json({ ok: true, data: enriched, ts: Date.now() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    handleRateLimitMessage(msg);
    console.error("[/api/v1/market/live]", msg);
    return NextResponse.json({
      ok: false,
      error: msg,
      rateLimited: isRateLimited(),
      data: [],
    }, { status: 200 });
  }
}
