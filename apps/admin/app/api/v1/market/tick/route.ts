import { NextResponse, type NextRequest } from "next/server";
import { getYahooQuotes } from "@/lib/yahoo-quote";
import { withFeedCache } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/market/tick?token=99926000&exchange=NSE&symbol=NIFTY+50
 * Legacy single-symbol OHLC — prefer /api/v1/market/stream for live LTP.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exchange = searchParams.get("exchange") ?? "NSE";
  const symbol = searchParams.get("symbol") ?? "";
  const token = searchParams.get("token") ?? "";

  // Yahoo prices off the name, so the token is only an identity for the reply.
  if (!symbol) return NextResponse.json({ ok: false, error: "Missing symbol" });

  try {
    const rows = await withFeedCache(`tick:${exchange}:${symbol}`, 15_000, 60_000, () =>
      getYahooQuotes([{ exchange, symboltoken: token || symbol, tradingSymbol: symbol }]),
    );
    const q = rows[0];
    if (!q) return NextResponse.json({ ok: false, error: "No data" });
    return NextResponse.json({
      ok: true,
      ltp: q.ltp,
      open: q.open,
      high: q.high,
      low: q.low,
      netChange: q.netChange,
      pctChange: q.percentChange,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error("[/api/v1/market/tick]", msg);
    return NextResponse.json({ ok: false, error: msg });
  }
}
