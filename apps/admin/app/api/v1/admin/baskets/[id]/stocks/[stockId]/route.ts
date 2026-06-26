import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeBasketStock } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; stockId: string }> };

/** PUT /api/v1/admin/baskets/:id/stocks/:stockId */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id, stockId: sid } = await ctx.params;
  const basketId = Number(id);
  const stockId = Number(sid);
  if (!Number.isFinite(basketId) || !Number.isFinite(stockId)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  try {
    const stock = await finuerBasketRepository.updateBasketStock(basketId, stockId, {
      symbol: body.symbol,
      stockName: body.stockName ?? body.stock_name,
      exchange: body.exchange,
      weightPct: body.weightPct != null ? Number(body.weightPct) : body.weight_pct != null ? Number(body.weight_pct) : undefined,
      cmp: body.cmp != null ? Number(body.cmp) : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      reason: body.reason ?? null,
    });
    return NextResponse.json({ ok: true, data: serializeBasketStock(stock) });
  } catch {
    return NextResponse.json({ ok: false, error: "Stock not found" }, { status: 404 });
  }
}

/** DELETE /api/v1/admin/baskets/:id/stocks/:stockId */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id, stockId: sid } = await ctx.params;
  const basketId = Number(id);
  const stockId = Number(sid);

  try {
    const body = await req.json().catch(() => ({}));
    await finuerBasketRepository.deleteBasketStock(basketId, stockId, body.reason ?? null);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Stock not found" }, { status: 404 });
  }
}
