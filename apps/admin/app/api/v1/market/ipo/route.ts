import { NextResponse, type NextRequest } from "next/server";
import { getIpoBoard } from "@/lib/ipo-feed";

import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // These proxy upstream providers — one of them spends Angel One quota —
  // so they match their siblings and stay behind auth. The Markets page is
  // authed anyway; only /api/v1/market/fx is deliberately public.
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

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
