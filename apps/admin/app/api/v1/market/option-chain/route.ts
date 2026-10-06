import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/market/option-chain */
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "Option chain requires a connected broker account.",
    data: null,
    authRequired: true,
  });
}

