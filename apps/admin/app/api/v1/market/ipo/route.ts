import { NextResponse } from "next/server";
import { getIpoBoard } from "@/lib/ipo-feed";


export const dynamic = "force-dynamic";

export async function GET() {
  // These proxy upstream providers — one of them spends Angel One quota —
  // so they match their siblings and stay behind auth. The Markets page is
  // authed anyway; only /api/v1/market/fx is deliberately public.
  try {
    const { issues, provider, stale } = await getIpoBoard();
    return NextResponse.json({ ok: true, issues, provider, stale: Boolean(stale) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Couldn't load IPO data", issues: [] },
      { status: 502 },
    );
  }
}
