import { NextResponse, type NextRequest } from "next/server";
import { refreshOptionChainQuotes } from "@/lib/dhan";
import { handleRateLimitMessage, isRateLimited, withMarketCache } from "@/lib/market-rate-limit";
import { blockDhanAuth, isDhanAuthBlocked } from "../route";

export const dynamic = "force-dynamic";

/** POST /api/v1/market/option-chain/refresh — silent LTP/OI refresh for live chain */
export async function POST(req: NextRequest) {
  try {
    if (isDhanAuthBlocked() || isRateLimited()) {
      return NextResponse.json({
        ok: false,
        error: "Option chain refresh paused",
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
    for (const [token, q] of Object.entries(map)) {
      quotes[token] = {
        ltp: q.ltp,
        netChange: q.netChange,
        percentChange: q.percentChange,
        tradeVolume: q.tradeVolume,
        opnInterest: q.opnInterest,
        oiChange: q.oiChange,
        oiChangePct: q.oiChangePct,
      };
    }
    return NextResponse.json({ ok: true, quotes, ts: Date.now() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    handleRateLimitMessage(msg);
    if (/401|Unauthorized|invalid token|808/i.test(msg)) blockDhanAuth();
    return NextResponse.json({
      ok: false,
      error: msg,
      rateLimited: isRateLimited(),
      quotes: {},
    }, { status: 200 });
  }
}

