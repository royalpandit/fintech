import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Option chain requires a live broker connection (Dhan/Zerodha).
// Yahoo Finance has no option chain API. Disabled until a broker is connected.
export function isDhanAuthBlocked() { return true; }
export function blockDhanAuth() { /* no-op */ }

/** GET /api/v1/market/option-chain */
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "Option chain requires a connected broker account.",
    data: null,
    authRequired: true,
  });
}

