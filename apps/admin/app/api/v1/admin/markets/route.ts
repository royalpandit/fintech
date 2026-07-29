import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeMarket } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/markets — list all markets */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const markets = await finuerBasketRepository.listMarkets();
  return NextResponse.json({ ok: true, data: markets.map(serializeMarket) });
}

/** POST /api/v1/admin/markets — create market */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

  const status = body.status === "inactive" ? "inactive" : "active";

  try {
    const market = await finuerBasketRepository.createMarket(name, status);
    return NextResponse.json({ ok: true, data: serializeMarket(market) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create market";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
