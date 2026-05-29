import { NextResponse, type NextRequest } from "next/server";
import { getExtendedQuotes, MARKET_INSTRUMENTS, type QuoteInstrument } from "@/lib/angelone";
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
    const byExchange = all.reduce<Record<string, string[]>>((acc, i) => {
      (acc[i.exchange] ||= []).push(i.symboltoken);
      return acc;
    }, {});

    const quoteMap = await withMarketCache(cacheKey, 4_000, async () => {
      const merged = new Map<string, Record<string, unknown>>();
      for (const [exch, tokens] of Object.entries(byExchange)) {
        const m = await getExtendedQuotes(exch, tokens);
        m.forEach((q, tok) => merged.set(tok, q as unknown as Record<string, unknown>));
      }
      return merged;
    });

    const symMap: Record<string, string> = Object.fromEntries(MARKET_INSTRUMENTS.map(m => [m.token, m.symbol]));
    const enriched = all.map(inst => {
      const q = quoteMap.get(inst.symboltoken);
      if (!q) {
        return {
          symbolToken: inst.symboltoken,
          tradingSymbol: inst.tradingSymbol,
          exchange: inst.exchange,
          ltp: 0,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          percentChange: 0,
          netChange: 0,
          displaySymbol: symMap[inst.symboltoken] ?? inst.tradingSymbol,
        };
      }
      return {
        symbolToken: String(q.symbolToken ?? inst.symboltoken),
        tradingSymbol: String(q.tradingSymbol ?? inst.tradingSymbol),
        exchange: String(q.exchange ?? inst.exchange),
        ltp: Number(q.ltp) || 0,
        open: Number(q.open) || 0,
        high: Number(q.high) || 0,
        low: Number(q.low) || 0,
        close: Number(q.close) || 0,
        percentChange: Number(q.percentChange) || 0,
        netChange: Number(q.netChange) || 0,
        tradeVolume: q.tradeVolume != null ? Number(q.tradeVolume) : undefined,
        volume: q.tradeVolume != null ? Number(q.tradeVolume) : undefined,
        displaySymbol: symMap[inst.symboltoken] ?? inst.tradingSymbol,
      };
    });

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
