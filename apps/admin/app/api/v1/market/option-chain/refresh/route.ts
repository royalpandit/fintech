import { NextResponse, type NextRequest } from "next/server";
import { getNseOptionChain } from "@/lib/nse-option-chain";
import { withFeedCache } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";

/*
 * POST /api/v1/market/option-chain/refresh — silent LTP/OI tick for the open chain.
 *
 * NSE returns prices and OI in the same payload as the strikes, so this reads
 * the same cached chain the initial load used rather than quoting leg by leg.
 * The client polls every 15 s and the cache holds for 60, so NSE itself is hit
 * about once a minute no matter how many people have the panel open.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { symbol?: string; expiry?: string };
    const symbol = body.symbol;
    if (!symbol) return NextResponse.json({ ok: true, quotes: {}, ts: Date.now() });

    const chain = await withFeedCache(
      `nse-oc:${symbol}:${body.expiry ?? "near"}`,
      60_000,
      2 * 60_000,
      () => getNseOptionChain({ symbol, expiry: body.expiry }),
    );
    if (!chain) return NextResponse.json({ ok: false, quotes: {} });

    const quotes: Record<string, unknown> = {};
    for (const row of chain.rows) {
      for (const leg of [row.ce, row.pe]) {
        if (!leg) continue;
        quotes[leg.token] = {
          ltp: leg.ltp,
          netChange: leg.change,
          percentChange: leg.changePct,
          tradeVolume: leg.volume,
          opnInterest: leg.oi,
          oiChange: leg.oiChange,
          oiChangePct: leg.oiChangePct,
        };
      }
    }
    return NextResponse.json({ ok: true, quotes, ts: Date.now() });
  } catch (err) {
    console.error("[option-chain/refresh]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, quotes: {} });
  }
}
