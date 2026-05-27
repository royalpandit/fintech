import { NextResponse, type NextRequest } from "next/server";
import { getOptionChain, optionUnderlyingKey } from "@/lib/angelone";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/option-chain?symbol=RELIANCE&display=RELIANCE&ltp=2500 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tradingSymbol = searchParams.get("symbol") ?? "";
    const display = searchParams.get("display") ?? tradingSymbol;
    const spot = searchParams.get("ltp");
    const expiry = searchParams.get("expiry") ?? undefined;

    const underlying = optionUnderlyingKey(tradingSymbol, display);
    if (!underlying) {
      return NextResponse.json({
        ok: false,
        error: "Option chain is available for indices and equity symbols only.",
        data: null,
      });
    }

    const chain = await getOptionChain(
      underlying,
      spot ? Number(spot) : undefined,
      expiry
    );
    return NextResponse.json({ ok: true, data: chain });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/v1/market/option-chain]", msg);
    return NextResponse.json({ ok: false, error: msg, data: null }, { status: 200 });
  }
}
