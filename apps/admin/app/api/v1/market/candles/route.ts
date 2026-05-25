import { NextResponse, type NextRequest } from "next/server";
import { getCandles, setAccessToken, isAuthenticated, type CandleInterval } from "@/lib/zerodha";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/candles?token=256265&exchange=NSE&interval=ONE_DAY&days=90 */
export async function GET(req: NextRequest) {
  // Re-hydrate token from cookie if cache is cold (after server restart)
  if (!isAuthenticated()) {
    const cookie = req.cookies.get("zerodha_token")?.value;
    if (cookie) setAccessToken(cookie);
  }

  try {
    const { searchParams } = new URL(req.url);
    const token    = searchParams.get("token");
    const exchange = searchParams.get("exchange") ?? "NSE";
    const interval = (searchParams.get("interval") ?? "ONE_DAY") as CandleInterval;
    const days     = Math.min(365, Math.max(1, Number(searchParams.get("days") ?? "90")));

    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const now  = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt  = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 09:15`;

    const candles = await getCandles({ exchange, symboltoken: token, interval, fromdate: fmt(from), todate: fmt(now) });
    return NextResponse.json({ ok: true, token, data: candles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v1/market/candles]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
