import { NextResponse, type NextRequest } from "next/server";
import { getCandles, setAccessToken, isAuthenticated, type CandleInterval } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/candles?token=256265&exchange=NSE&interval=ONE_DAY&days=90 */
export async function GET(req: NextRequest) {
  const authed = isAuthenticated();
  const cookie = req.cookies.get("zerodha_token")?.value;
  console.log("[candles] authed=%s hasCookie=%s", authed, !!cookie);

  if (!authed) {
    if (cookie) {
      setAccessToken(cookie);
      console.log("[candles] re-hydrated token from cookie");
    } else {
      console.log("[candles] no token and no cookie — returning 401");
      return NextResponse.json({ ok: false, error: "Zerodha not authenticated — visit /api/v1/auth/zerodha/login" }, { status: 200 });
    }
  }

  try {
    const { searchParams } = new URL(req.url);
    const token    = searchParams.get("token");
    const exchange = searchParams.get("exchange") ?? "NSE";
    const interval = (searchParams.get("interval") ?? "ONE_DAY") as CandleInterval;

    // Zerodha per-interval hard limits (days)
    const INTERVAL_MAX: Partial<Record<CandleInterval, number>> = {
      ONE_MINUTE:     60,
      THREE_MINUTE:   100,
      FIVE_MINUTE:    100,
      TEN_MINUTE:     100,
      FIFTEEN_MINUTE: 200,
      THIRTY_MINUTE:  200,
      ONE_HOUR:       400,
      ONE_DAY:        2000,
    };
    const maxDays  = INTERVAL_MAX[interval] ?? 60;
    const days     = Math.min(maxDays, Math.max(1, Number(searchParams.get("days") ?? "90")));

    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const now  = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt  = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 09:15`;

    const fromdate = fmt(from);
    const todate   = fmt(now);
    console.log("[candles] fetching token=%s exchange=%s interval=%s from=%s to=%s", token, exchange, interval, fromdate, todate);

    const candles = await getCandles({ exchange, symboltoken: token, interval, fromdate, todate });
    console.log("[candles] got %d candles", candles.length);
    return NextResponse.json({ ok: true, token, data: candles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[candles] ERROR:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
