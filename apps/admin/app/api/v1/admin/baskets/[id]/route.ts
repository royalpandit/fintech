import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseTimePeriod, serializeBasket } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/admin/baskets/:id */
export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const timePeriod = parseTimePeriod(req.nextUrl.searchParams.get("time_period"));
  const basket = await finuerBasketRepository.findBasketById(id);
  if (!basket) return NextResponse.json({ ok: false, error: "Basket not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: serializeBasket(basket, timePeriod, { includeRebalance: true }) });
}

/** PUT /api/v1/admin/baskets/:id */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const body = await req.json();

  try {
    const basket = await finuerBasketRepository.updateBasket(id, {
      basketName: body.basketName ?? body.basket_name,
      shortDescription: body.shortDescription ?? body.short_description,
      methodology: body.methodology,
      marketId: body.marketId != null ? Number(body.marketId) : body.market_id != null ? Number(body.market_id) : undefined,
      typeId: body.typeId != null ? Number(body.typeId) : body.type_id != null ? Number(body.type_id) : undefined,
      benchmarkId:
        body.benchmarkId != null
          ? Number(body.benchmarkId)
          : body.benchmark_id != null
            ? Number(body.benchmark_id)
            : undefined,
      status: body.status,
      visibility: body.visibility,
      rebalanceFrequency: body.rebalanceFrequency ?? body.rebalance_frequency,
      requiredPlan: body.requiredPlan ?? body.required_plan,
    });
    return NextResponse.json({ ok: true, data: serializeBasket(basket) });
  } catch {
    return NextResponse.json({ ok: false, error: "Basket not found" }, { status: 404 });
  }
}

/** PATCH /api/v1/admin/baskets/:id — activate/deactivate */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  if (body.status !== "active" && body.status !== "inactive") {
    return NextResponse.json({ ok: false, error: "status must be active or inactive" }, { status: 400 });
  }

  try {
    const basket = await finuerBasketRepository.setBasketStatus(id, body.status);
    return NextResponse.json({ ok: true, data: serializeBasket(basket) });
  } catch {
    return NextResponse.json({ ok: false, error: "Basket not found" }, { status: 404 });
  }
}

/** DELETE /api/v1/admin/baskets/:id */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  try {
    await finuerBasketRepository.deleteBasket(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Basket not found" }, { status: 404 });
  }
}
