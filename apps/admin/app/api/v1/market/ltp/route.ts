import { NextResponse, type NextRequest } from "next/server";
import { setAccessToken, isAuthenticated, getAccessToken } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

const BASE    = "https://api.kite.trade";
const API_KEY = () => process.env.ZERODHA_API_KEY!;

/** GET /api/v1/market/ltp?token=256265&exchange=NSE&symbol=NIFTY+50
 *  Returns { ok, ltp, open, high, low, close, netChange, pctChange } for one instrument.
 *  Designed for 1-second polling — minimal payload. */
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    const cookie = req.cookies.get("zerodha_token")?.value;
    if (cookie) setAccessToken(cookie);
    else return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 200 });
  }

  const { searchParams } = new URL(req.url);
  const token    = searchParams.get("token");
  const exchange = searchParams.get("exchange") ?? "NSE";
  const symbol   = searchParams.get("symbol");

  if (!token || !symbol) {
    return NextResponse.json({ ok: false, error: "Missing token or symbol" }, { status: 400 });
  }

  try {
    const key = `${exchange}:${decodeURIComponent(symbol)}`;
    const res  = await fetch(`${BASE}/quote/ohlc?i=${encodeURIComponent(key)}`, {
      headers: {
        "X-Kite-Version": "3",
        "Authorization": `token ${API_KEY()}:${getAccessToken()}`,
      },
      cache: "no-store",
    });
    const data = await res.json();
    const entry = data.data?.[key] ?? data.data?.[key.toUpperCase()];
    if (!entry) return NextResponse.json({ ok: false, error: "No data" }, { status: 200 });

    const close = entry.ohlc?.close ?? 0;
    const ltp   = entry.last_price ?? 0;
    return NextResponse.json({
      ok:        true,
      ltp,
      open:      entry.ohlc?.open  ?? 0,
      high:      entry.ohlc?.high  ?? 0,
      low:       entry.ohlc?.low   ?? 0,
      close,
      netChange: entry.net_change  ?? (ltp - close),
      pctChange: close > 0 ? ((ltp - close) / close) * 100 : 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
