import { NextResponse, type NextRequest } from "next/server";
import { refreshOptionChainQuotes } from "@/lib/angelone";
import { handleRateLimitMessage, isRateLimited, withMarketCache } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/v1/market/option-chain/refresh — silent LTP/OI refresh for live chain */
export async function POST(req: NextRequest) {
  try {
    if (isRateLimited()) {
      return NextResponse.json({
        ok: false,
        error: "Rate limit — option chain refresh paused",
        rateLimited: true,
        quotes: {},
      });
    }

    const body = (await req.json()) as { exchange?: string; tokens?: string[] };
    const exchange = body.exchange ?? "NFO";
    const tokens = body.tokens ?? [];
    if (!tokens.length) {
      return NextResponse.json({ ok: true, quotes: {}, ts: Date.now() });
    }

    const cacheKey = `oc-refresh:${exchange}:${tokens.length}:${tokens[0]}:${tokens[tokens.length - 1]}`;
    const map = await withMarketCache(cacheKey, 10_000, () =>
      refreshOptionChainQuotes(exchange, tokens)
    );

    const quotes: Record<string, unknown> = {};
    for (const [token, q] of map) {
      quotes[token] = {
        ltp: q.ltp,
        netChange: q.netChange,
        percentChange: q.percentChange,
        tradeVolume: q.tradeVolume,
        opnInterest: q.opnInterest,
        oiChange: q.opnInterestChange,
        oiChangePct: q.opnInterestChangePct,
      };
    }
    return NextResponse.json({ ok: true, quotes, ts: Date.now() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    handleRateLimitMessage(msg);
    return NextResponse.json({
      ok: false,
      error: msg,
      rateLimited: isRateLimited(),
      quotes: {},
    }, { status: 200 });
  }
}
