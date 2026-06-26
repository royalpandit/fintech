import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeBasket } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/v1/admin/baskets/:id/recalculate — auto-calculate performance from holdings */
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  try {
    const basket = await finuerBasketRepository.validateAndRecalculate(id);
    return NextResponse.json({ ok: true, data: serializeBasket(basket!, "1_year", { includeRebalance: true }) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to recalculate performance";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
