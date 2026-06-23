import { NextResponse, type NextRequest } from "next/server";
import { FINUER_BASKET_API_DOCS, serializeBasket } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/baskets
 *
 * Public user API — returns active + public baskets only.
 *
 * Query params:
 * - market_id: filter by market
 * - type_id: filter by basket type
 * - time_period: 1_month | 6_months | 1_year | 3_years | 5_years | since_launch
 * - sort_order: highest_return | lowest_return
 */
export async function GET(req: NextRequest) {
  const filters = finuerBasketRepository.parseListQuery(req.nextUrl.searchParams);
  const baskets = await finuerBasketRepository.listBaskets({
    ...filters,
    activeOnly: true,
    publicOnly: true,
  });

  const [markets, types] = await Promise.all([
    finuerBasketRepository.listMarkets(),
    finuerBasketRepository.listTypes(),
  ]);

  return NextResponse.json({
    ok: true,
    data: baskets.map((b) => serializeBasket(b, filters.timePeriod)),
    meta: {
      count: baskets.length,
      filters,
      markets: markets.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name })),
      types: types.filter((t) => t.status === "active").map((t) => ({ id: t.id, name: t.name })),
      docs: FINUER_BASKET_API_DOCS.user,
    },
  });
}
