import { NextResponse, type NextRequest } from "next/server";
import { getMarketDepth } from "@/lib/angelone";
import { handleRateLimitMessage, isRateLimited, withMarketCache } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/depth?token=&exchange=NFO&tradingSymbol= */
export async function GET(req: NextRequest) {
  try {
    if (isRateLimited()) {
      return NextResponse.json({
        ok: false,
        error: "Rate limit — market depth paused",
        rateLimited: true,
      });
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const exchange = searchParams.get("exchange") ?? "NFO";
    const tradingSymbol = searchParams.get("tradingSymbol") ?? undefined;

    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    const cacheKey = `depth:${exchange}:${token}`;
    const data = await withMarketCache(cacheKey, 3_000, () =>
      getMarketDepth(exchange, token, tradingSymbol)
    );

    if (!data) {
      return NextResponse.json({ ok: false, error: "No depth data" });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    handleRateLimitMessage(msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
