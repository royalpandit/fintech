import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { FINUER_BASKET_API_DOCS, serializeBasket } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/baskets — list with filters */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const filters = finuerBasketRepository.parseListQuery(req.nextUrl.searchParams);
  const baskets = await finuerBasketRepository.listBaskets(filters);

  return NextResponse.json({
    ok: true,
    data: baskets.map((b) => serializeBasket(b, filters.timePeriod)),
    meta: { filters, docs: FINUER_BASKET_API_DOCS.admin.baskets },
  });
}

/** POST /api/v1/admin/baskets — create basket */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const basketName = String(body.basketName ?? body.basket_name ?? "").trim();
  const marketId = Number(body.marketId ?? body.market_id);
  const typeId = Number(body.typeId ?? body.type_id);
  const benchmarkId = Number(body.benchmarkId ?? body.benchmark_id);

  if (!basketName) {
    return NextResponse.json({ ok: false, error: "basketName is required" }, { status: 400 });
  }
  if (!Number.isFinite(marketId) || !Number.isFinite(typeId) || !Number.isFinite(benchmarkId)) {
    return NextResponse.json(
      { ok: false, error: "marketId, typeId, and benchmarkId are required" },
      { status: 400 },
    );
  }

  try {
    const basket = await finuerBasketRepository.createBasket({
      basketName,
      shortDescription: body.shortDescription ?? body.short_description ?? null,
      methodology: body.methodology ?? null,
      marketId,
      typeId,
      benchmarkId,
      status: body.status === "inactive" ? "inactive" : "active",
      visibility: body.visibility === "hidden" ? "hidden" : "public",
      rebalanceFrequency: ["weekly", "monthly", "quarterly"].includes(body.rebalanceFrequency)
        ? body.rebalanceFrequency
        : ["weekly", "monthly", "quarterly"].includes(body.rebalance_frequency)
          ? body.rebalance_frequency
          : "monthly",
      requiredPlan: body.requiredPlan === "premium" || body.required_plan === "premium" ? "premium" : "free",
      createdById: auth.userId,
    });
    return NextResponse.json({ ok: true, data: serializeBasket(basket) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create basket";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
