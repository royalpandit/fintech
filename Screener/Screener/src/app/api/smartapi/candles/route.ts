import { NextResponse } from "next/server";
import { formatApiError } from "@/lib/smartapi/http";
import { fetchCandles } from "@/lib/smartapi/market";
import { resolveSymbol } from "@/lib/smartapi/symbols";
import { toApiInterval } from "@/lib/smartapi/intervals";
import type { ChartTimeframe } from "@/lib/smartapi/types";

const VALID: ChartTimeframe[] = [
  "SEC_15", "SEC_30", "SEC_45",
  "ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "ONE_HOUR", "ONE_DAY",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolQuery = searchParams.get("symbol") ?? "RELIANCE";
    const timeframe = (searchParams.get("interval") ??
      "ONE_DAY") as ChartTimeframe;

    if (!VALID.includes(timeframe)) {
      return NextResponse.json(
        { error: "Invalid interval" },
        { status: 400 },
      );
    }

    const interval = toApiInterval(timeframe);

    const symbol = await resolveSymbol(symbolQuery);
    const candles = await fetchCandles(symbol, interval);

    return NextResponse.json({ symbol, candles, timeframe });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error) },
      { status: 500 },
    );
  }
}
