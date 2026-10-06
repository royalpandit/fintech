import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST /api/v1/market/option-chain/refresh — disabled, no broker connected */
export async function POST() {
  return NextResponse.json({ ok: false, rateLimited: true, quotes: {} });
}

