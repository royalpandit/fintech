import { NextResponse, type NextRequest } from "next/server";
import { getCandles, resolveMarketExchange, type CandleInterval } from "@/lib/angelone";
import { enrichCandlesWithVolume } from "@/lib/chart-volume";
import { angelCandleRange } from "@/lib/nse-market-time";
import { handleRateLimitMessage, isRateLimited, withMarketCache } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/candles?token=99926000&exchange=NSE&interval=ONE_DAY&days=90 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token         = searchParams.get("token");
    const tradingSymbol = searchParams.get("tradingSymbol") ?? undefined;
    const instrumentType = searchParams.get("instrumentType") ?? undefined;
    const exchange = resolveMarketExchange({
      exchange: searchParams.get("exchange") ?? "NSE",
      symboltoken: token,
      tradingSymbol,
      instrumentType,
    });
    const interval = (searchParams.get("interval") ?? "ONE_DAY") as CandleInterval;

    const INTERVAL_MAX: Partial<Record<CandleInterval, number>> = {
      ONE_MINUTE:     30,
      THREE_MINUTE:   60,
      FIVE_MINUTE:    100,
      TEN_MINUTE:     100,
      FIFTEEN_MINUTE: 200,
      THIRTY_MINUTE:  200,
      ONE_HOUR:       400,
      ONE_DAY:        2000,
    };
    const maxDays = INTERVAL_MAX[interval] ?? 60;
    const days    = Math.min(maxDays, Math.max(1, Number(searchParams.get("days") ?? "90")));

    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const { fromdate, todate } = angelCandleRange(days);

    console.log("[candles] token=%s exchange=%s interval=%s from=%s to=%s", token, exchange, interval, fromdate, todate);

    if (isRateLimited()) {
      return NextResponse.json({
        ok: false,
        error: "Angel One rate limit — chart refresh paused. Please wait.",
        rateLimited: true,
      }, { status: 200 });
    }

    const cacheKey = `candles:v2:${token}:${exchange}:${interval}:${days}`;
    const candles = await withMarketCache(cacheKey, 8_000, async () => {
      const raw = await getCandles({
        exchange,
        symboltoken: token,
        tradingSymbol,
        instrumentType,
        interval,
        fromdate,
        todate,
      });
      return enrichCandlesWithVolume(raw, {
        exchange,
        symboltoken: token,
        tradingSymbol,
        instrumentType,
        interval,
        fromdate,
        todate,
      });
    });
    const volSample = candles.find(c => c.volume > 0)?.volume ?? 0;
    console.log("[candles] got %d candles (sample vol %s)", candles.length, volSample);
    return NextResponse.json({ ok: true, token, data: candles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    handleRateLimitMessage(msg);
    console.error("[candles] ERROR:", msg);
    return NextResponse.json({ ok: false, error: msg, rateLimited: isRateLimited() }, { status: 200 });
  }
}
