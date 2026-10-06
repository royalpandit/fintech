import { NextResponse, type NextRequest } from "next/server";
import { optionUnderlyingKey } from "@/lib/dhan";
import { getNseOptionChain } from "@/lib/nse-option-chain";
import { withFeedCache } from "@/lib/market-rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/option-chain?symbol=TCS&display=TCS&expiry=27-Oct-2026 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tradingSymbol = searchParams.get("symbol") ?? "";
    const display = searchParams.get("display") ?? tradingSymbol;
    const expiry = searchParams.get("expiry") ?? undefined;

    const underlying = optionUnderlyingKey(tradingSymbol, display);
    if (!underlying) {
      return NextResponse.json({
        ok: false,
        error: "Option chain is available for indices and F&O stocks only.",
        data: null,
      });
    }

    // NSE blocks rapid polling, so one fetch is shared for 60 s and served
    // stale for another two minutes while it refreshes behind the request.
    const chain = await withFeedCache(
      `nse-oc:${underlying}:${expiry ?? "near"}`,
      60_000,
      2 * 60_000,
      () => getNseOptionChain({ symbol: underlying, expiry }),
    );

    if (chain && chain.rows.length > 0) {
      console.log("[option-chain] nse: %s %d strikes spot=%s", underlying, chain.rows.length, chain.spot);
      return NextResponse.json({ ok: true, data: chain, source: "nse" });
    }

    return NextResponse.json({
      ok: false,
      error: `Option chain not available for ${underlying}.`,
      data: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v1/market/option-chain]", msg);
    return NextResponse.json({ ok: false, error: "Option chain temporarily unavailable.", data: null });
  }
}
