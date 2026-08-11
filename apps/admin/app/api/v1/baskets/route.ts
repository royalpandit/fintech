import { NextResponse, type NextRequest } from "next/server";
import { FINUER_BASKET_API_DOCS, serializeBasket } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";
import { requireAuth } from "@/lib/auth";
import { lockPremiumBasketPayload, userHasFinuerPro } from "@/lib/finuer-pro";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/baskets
 *
 * Public user API — returns active + public baskets only.
 * Premium baskets are locked (blurred payload) unless the viewer has Finuer Pro.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  const hasPro = await userHasFinuerPro(auth?.userId, auth?.role);

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
    data: baskets.map((b) =>
      lockPremiumBasketPayload(
        serializeBasket(b, filters.timePeriod) as Record<string, unknown>,
        hasPro,
      ),
    ),
    meta: {
      count: baskets.length,
      filters,
      hasFinuerPro: hasPro,
      markets: markets.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name })),
      types: types.filter((t) => t.status === "active").map((t) => ({ id: t.id, name: t.name })),
      docs: FINUER_BASKET_API_DOCS.user,
    },
  });
}
