import { NextResponse } from "next/server";
import { getCandles, MARKET_INSTRUMENTS, type CandleInterval } from "@/lib/angelone";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/market/candles?symbol=RELIANCE&interval=ONE_DAY&days=90
 * Returns OHLCV candle data for a given symbol.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbolParam = searchParams.get("symbol") ?? "NIFTY 50";
    const interval = (searchParams.get("interval") ?? "ONE_DAY") as CandleInterval;
    const days = Math.min(365, Math.max(1, Number(searchParams.get("days") ?? "90")));

    const instrument = MARKET_INSTRUMENTS.find((m) => m.symbol === symbolParam);
    if (!instrument) {
      return NextResponse.json(
        { ok: false, error: `Unknown symbol: ${symbolParam}` },
        { status: 400 }
      );
    }

    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 09:15`;

    const candles = await getCandles({
      exchange: instrument.exchange,
      symboltoken: instrument.token,
      interval,
      fromdate: fmt(from),
      todate: fmt(now),
    });

    return NextResponse.json({ ok: true, symbol: symbolParam, data: candles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
