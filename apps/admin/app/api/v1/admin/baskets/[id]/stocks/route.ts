import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { serializeBasketStock } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/admin/baskets/:id/stocks */
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const basketId = Number((await ctx.params).id);
  if (!Number.isFinite(basketId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const stocks = await finuerBasketRepository.listBasketStocks(basketId);
  return NextResponse.json({ ok: true, data: stocks.map(serializeBasketStock) });
}

/** POST /api/v1/admin/baskets/:id/stocks */
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const basketId = Number((await ctx.params).id);
  if (!Number.isFinite(basketId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const symbol = String(body.symbol ?? "").trim();
  const stockName = String(body.stockName ?? body.stock_name ?? "").trim();
  if (!symbol || !stockName) {
    return NextResponse.json({ ok: false, error: "symbol and stockName are required" }, { status: 400 });
  }

  try {
    const stock = await finuerBasketRepository.addBasketStock(basketId, {
      symbol,
      stockName,
      exchange: body.exchange,
      weightPct: body.weightPct != null ? Number(body.weightPct) : body.weight_pct != null ? Number(body.weight_pct) : null,
      cmp: body.cmp != null ? Number(body.cmp) : null,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      reason: body.reason ?? null,
    });
    return NextResponse.json({ ok: true, data: serializeBasketStock(stock) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add stock";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
