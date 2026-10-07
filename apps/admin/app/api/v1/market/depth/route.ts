import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/*
 * GET /api/v1/market/depth
 *
 * Order-book depth is broker-only. It is a level-2 exchange feed: no free,
 * unauthenticated source publishes resting bids and offers, and Yahoo carries
 * nothing below the last traded price. The route answers rather than calling a
 * broker so the panel can say so instead of spinning.
 */
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "Market depth needs a connected broker — no free feed publishes the order book.",
    brokerRequired: true,
  });
}
