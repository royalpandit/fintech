import { NextResponse, type NextRequest } from "next/server";
import { resolveMarketExchange, type CandleInterval } from "@/lib/dhan";
import { angelCandleRange } from "@/lib/nse-market-time";
import { withFeedCache } from "@/lib/market-rate-limit";
import { getYahooCandles, yahooTickerFor } from "@/lib/yahoo-quote";
import { MARKET_INSTRUMENTS } from "@/lib/angelone-shared";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/candles?token=99926000&exchange=NSE&interval=ONE_DAY&days=90 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    // `symbol` is the plain-name alias callers use when they have no token —
    // Yahoo prices off the name, so a token is not something they need to know.
    const tradingSymbol =
      searchParams.get("tradingSymbol") ?? searchParams.get("symbol") ?? undefined;
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

    // Only Dhan needs a token; Yahoo runs off the symbol, so either will do.
    if (!token && !tradingSymbol) {
      return NextResponse.json({ ok: false, error: "Missing token or symbol" }, { status: 400 });
    }

    const { fromdate, todate } = angelCandleRange(days);

    console.log("[candles] token=%s symbol=%s exchange=%s interval=%s from=%s to=%s",
      token, tradingSymbol, exchange, interval, fromdate, todate);

    // Yahoo is primary for historical candles — no token needed.
    // When tradingSymbol is missing, resolve the numeric token to its symbol
    // (e.g. "11536" → "TCS") so Yahoo gets a valid ticker like "TCS.NS".
    const rawSym = tradingSymbol ?? token ?? "";
    const resolved = /^\d+$/.test(rawSym)
      ? (MARKET_INSTRUMENTS.find(m => m.token === rawSym)?.symbol ?? rawSym)
      : rawSym;
    const sym = resolved;
    const yahooTicker = yahooTickerFor(sym, exchange);
    if (yahooTicker) {
      const yahooCacheKey = `candles:yahoo:${exchange}:${sym}:${interval}:${days}`;
      const yahooCandles = await withFeedCache(yahooCacheKey, 60_000, 5 * 60_000, () =>
        getYahooCandles({ tradingSymbol: sym, exchange, interval, days }),
      );
      if (yahooCandles.length > 0) {
        console.log("[candles] yahoo: %d candles (%s) for %s", yahooCandles.length, interval, yahooTicker);
        return NextResponse.json({ ok: true, token, data: yahooCandles, source: "yahoo", interval });
      }

      // Yahoo often lacks intraday data for BSE/small-cap stocks.
      // Auto-downgrade to daily so the chart always shows something.
      if (interval !== "ONE_DAY") {
        const dailyCacheKey = `candles:yahoo:${exchange}:${sym}:ONE_DAY:365`;
        const dailyCandles = await withFeedCache(dailyCacheKey, 300_000, 10 * 60_000, () =>
          getYahooCandles({ tradingSymbol: sym, exchange, interval: "ONE_DAY", days: 365 }),
        );
        if (dailyCandles.length > 0) {
          console.log("[candles] yahoo daily fallback: %d candles for %s", dailyCandles.length, yahooTicker);
          return NextResponse.json({
            ok: true, token, data: dailyCandles, source: "yahoo",
            interval: "ONE_DAY",
            degraded: true,
            degradedReason: "Intraday data not available — showing daily candles",
          });
        }
      }
      console.warn("[candles] Yahoo returned 0 candles for %s", yahooTicker);
    }

    /*
     * An F&O contract has no free candle source at all. Yahoo carries US
     * options only — every NSE ticker comes back with an empty chain — and
     * NSE publishes the live option chain but answers 503 for per-contract
     * history. So it says what is actually true rather than naming a provider
     * the reader has no way to act on.
     */
    const derivative =
      /^(NFO|BFO|CDS|MCX)$/i.test(exchange) || /^(OPT|FUT)/i.test(instrumentType ?? "");

    return NextResponse.json({
      ok: false,
      error: derivative
        ? "No free feed publishes option or futures candles — chart the underlying instead."
        : "No candle data available for this instrument.",
      derivative,
      data: [],
    }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[candles] ERROR:", msg);
    return NextResponse.json({ ok: false, error: msg, data: [] }, { status: 200 });
  }
}

