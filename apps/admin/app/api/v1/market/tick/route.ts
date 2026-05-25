import { NextResponse, type NextRequest } from "next/server";
import { getLTP, setAccessToken, isAuthenticated } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/market/tick?token=256265&exchange=NSE&symbol=NIFTY+50
 * Lightweight single-symbol OHLC — polled every ~1s for the active chart symbol.
 */
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    const cookie = req.cookies.get("zerodha_token")?.value;
    if (cookie) setAccessToken(cookie);
  }

  const { searchParams } = new URL(req.url);
  const exchange = searchParams.get("exchange") ?? "NSE";
  const symbol   = searchParams.get("symbol") ?? "";
  const token    = searchParams.get("token") ?? "";

  if (!symbol || !token) return NextResponse.json({ ok: false, error: "Missing symbol/token" });

  try {
    const results = await getLTP([{ exchange, symboltoken: token, tradingsymbol: symbol }]);
    const q = results[0];
    if (!q) return NextResponse.json({ ok: false, error: "No data" });
    return NextResponse.json({
      ok:        true,
      ltp:       q.ltp,
      open:      q.open,
      high:      q.high,
      low:       q.low,
      netChange: q.netChange,
      pctChange: q.percentChange,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" });
  }
}
