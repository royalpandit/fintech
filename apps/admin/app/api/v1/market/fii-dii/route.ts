import { NextResponse } from "next/server";
import { getFiiDii } from "@/lib/nse-market-snapshots";


export const dynamic = "force-dynamic";

export async function GET() {
  // These proxy upstream providers — one of them spends Angel One quota —
  // so they match their siblings and stay behind auth. The Markets page is
  // authed anyway; only /api/v1/market/fx is deliberately public.
  try {
    const { rows, fetchedAt } = await getFiiDii();
    return NextResponse.json({ ok: true, rows, fetchedAt });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "FII/DII unavailable", rows: [] },
      { status: 502 },
    );
  }
}
