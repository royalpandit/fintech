import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeRebalanceEvent } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/admin/baskets/:id/rebalance-events */
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const basketId = Number((await ctx.params).id);
  if (!Number.isFinite(basketId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const events = await finuerBasketRepository.listRebalanceEvents(basketId);
  return NextResponse.json({ ok: true, data: events.map(serializeRebalanceEvent) });
}
