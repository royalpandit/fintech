import { NextResponse, type NextRequest } from "next/server";
import { parseTimePeriod, serializeBasket } from "@/lib/finuer-basket";
import { finuerBasketRepository } from "@/lib/finuer-basket-repository";
import { requireAuth } from "@/lib/auth";
import { lockPremiumBasketPayload, userHasFinuerPro } from "@/lib/finuer-pro";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/baskets/:id — public basket detail with stocks (premium gated). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const auth = await requireAuth(req);
  const hasPro = await userHasFinuerPro(auth?.userId, auth?.role);

  const timePeriod = parseTimePeriod(req.nextUrl.searchParams.get("time_period"));
  const basket = await finuerBasketRepository.findBasketById(id, true);
  if (!basket || basket.status !== "active" || basket.visibility !== "public") {
    return NextResponse.json({ ok: false, error: "Basket not found" }, { status: 404 });
  }

  const serialized = serializeBasket(basket, timePeriod, { includeRebalance: true });
  return NextResponse.json({
    ok: true,
    data: lockPremiumBasketPayload(serialized as Record<string, unknown>, hasPro),
    meta: { hasFinuerPro: hasPro },
  });
}
