import { NextResponse, type NextRequest } from "next/server";
import { optionUnderlyingKey } from "@/lib/dhan";
import { getYahooOptionChain } from "@/lib/yahoo-options";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/option-chain?symbol=RELIANCE&display=RELIANCE&ltp=2500&expiry=1728950400 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tradingSymbol = searchParams.get("symbol") ?? "";
    const display = searchParams.get("display") ?? tradingSymbol;
    const exchange = searchParams.get("exchange") ?? "NSE";
    const expiry = searchParams.get("expiry") ?? undefined;

    // Validate it's a supported underlying
    const underlying = optionUnderlyingKey(tradingSymbol, display);
    if (!underlying) {
      return NextResponse.json({
        ok: false,
        error: "Option chain is available for indices and major equity symbols only.",
        data: null,
      });
    }

    console.log("[option-chain] yahoo: %s exchange=%s expiry=%s", tradingSymbol, exchange, expiry);

    const chain = await getYahooOptionChain({ tradingSymbol, display, exchange, expiry });
    if (chain && chain.rows.length > 0) {
      console.log("[option-chain] yahoo: %d rows for %s", chain.rows.length, underlying);
      return NextResponse.json({ ok: true, data: chain, source: "yahoo" });
    }

    return NextResponse.json({
      ok: false,
      error: "Option chain data not available. Connect a broker for live option chain.",
      data: null,
      authRequired: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v1/market/option-chain]", msg);
    return NextResponse.json({ ok: false, error: "Option chain temporarily unavailable.", data: null });
  }
}
