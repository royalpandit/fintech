import { NextResponse, type NextRequest } from "next/server";
import { getLTP, MARKET_INSTRUMENTS, setAccessToken, isAuthenticated } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/market/live
 * Returns live OHLC + LTP for preset instruments plus any extras.
 * ?extra=TOKEN:EXCHANGE:SYMBOL,...  — for symbols added via search
 */
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    const cookie = req.cookies.get("zerodha_token")?.value;
    if (cookie) setAccessToken(cookie);
  }

  try {
    const { searchParams } = new URL(req.url);
    const extraParam = searchParams.get("extra") ?? "";

    const extraInstruments: { exchange: string; symboltoken: string; tradingsymbol: string }[] = extraParam
      ? extraParam.split(",").flatMap(t => {
          const [tok, exch, sym] = t.split(":");
          return tok && exch && sym ? [{ symboltoken: tok, exchange: exch, tradingsymbol: decodeURIComponent(sym) }] : [];
        })
      : [];

    const seen = new Set<string>(MARKET_INSTRUMENTS.map(m => m.token));
    const all: { exchange: string; symboltoken: string; tradingsymbol?: string }[] = [
      ...MARKET_INSTRUMENTS.map(m => ({ exchange: m.exchange, symboltoken: m.token })),
      ...extraInstruments.filter(e => !seen.has(e.symboltoken)),
    ];

    const quotes  = await getLTP(all);
    const symMap: Record<string, string> = Object.fromEntries(MARKET_INSTRUMENTS.map(m => [m.token, m.symbol]));
    const enriched = quotes.map(q => ({ ...q, displaySymbol: symMap[q.symbolToken] ?? q.tradingSymbol }));

    return NextResponse.json({ ok: true, data: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v1/market/live]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
