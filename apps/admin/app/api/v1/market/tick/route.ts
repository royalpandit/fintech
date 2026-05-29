import { NextResponse, type NextRequest } from "next/server";
import { getOHLC } from "@/lib/angelone";
import { handleRateLimitMessage, isRateLimited, withMarketCache } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/market/tick?token=99926000&exchange=NSE&symbol=NIFTY+50
 * Legacy single-symbol OHLC — prefer /api/v1/market/stream for live LTP.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exchange = searchParams.get("exchange") ?? "NSE";
  const symbol   = searchParams.get("symbol") ?? "";
  const token    = searchParams.get("token") ?? "";

  if (!symbol || !token) return NextResponse.json({ ok: false, error: "Missing symbol/token" });

  if (isRateLimited()) {
    return NextResponse.json({
      ok: false,
      error: "Angel One rate limit — tick paused",
      rateLimited: true,
    });
  }

  try {
    const cacheKey = `tick:${exchange}:${token}`;
    const results = await withMarketCache(cacheKey, 3_000, () =>
      getOHLC([{ exchange, symboltoken: token }]),
    );
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
    const msg = err instanceof Error ? err.message : "Unknown";
    handleRateLimitMessage(msg);
    return NextResponse.json({
      ok: false,
      error: msg,
      rateLimited: isRateLimited(),
    });
  }
}
