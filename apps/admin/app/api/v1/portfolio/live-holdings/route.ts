import { NextResponse } from "next/server";
import { getHoldings, getPositions } from "@/lib/angelone";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/portfolio/live-holdings
 * Returns Angel One holdings + open positions with live LTP data.
 */
export async function GET() {
  try {
    const [holdings, positions] = await Promise.all([
      getHoldings(),
      getPositions(),
    ]);

    const totalValue = holdings.reduce(
      (sum: number, h: { quantity: number; ltp: number }) => sum + h.quantity * h.ltp,
      0
    );
    const totalPnL = holdings.reduce(
      (sum: number, h: { profitandloss: number }) => sum + h.profitandloss,
      0
    );

    return NextResponse.json({
      ok: true,
      data: { holdings, positions, totalValue, totalPnL },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
