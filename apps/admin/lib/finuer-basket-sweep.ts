import { prisma } from "@/lib/prisma";
import { recalculateBasketPerformance } from "@/lib/finuer-basket-performance";

/**
 * Recompute every active basket's returns from live prices.
 *
 * lib/finuer-basket-performance.ts has done this correctly all along —
 * weighted holding returns over six windows, the benchmark index over the same
 * windows, and an outperforming/underperforming verdict from the two. The only
 * way to invoke it was POST /api/v1/admin/baskets/[id]/recalculate, one basket
 * at a time, by hand. Nothing ran it on a schedule and no create/update path
 * called it, so a basket held whatever numbers it had when an admin last
 * remembered to press the button — usually none at all.
 *
 * The visible result: baskets showed "—" for every return and were tagged
 * "Underperforming" — not because they were, but because that is the default
 * on the FinuerPerformanceStatus column and nothing had written a real verdict
 * over it. The user-facing page meanwhile claims "returns are calculated
 * automatically from holdings vs benchmark".
 *
 * Sequential on purpose. Each basket resolves every holding through the scrip
 * master and pulls a year of candles per symbol, and those calls are already
 * rate-limited upstream (scheduleAngelRest). Running baskets in parallel just
 * queues behind the same limiter while multiplying the chance of a partial
 * result, and this is a background job with no one waiting on it.
 */
export async function sweepFinuerBasketPerformance(): Promise<{
  checked: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Why each failure happened. A count on its own is not actionable. */
  errors?: { basket: string; reason: string }[];
}> {
  const baskets = await prisma.finuerBasket.findMany({
    where: { status: "active" },
    select: {
      id: true,
      basketName: true,
      _count: { select: { stocks: { where: { deletedAt: null } } } },
    },
    orderBy: { id: "asc" },
  });

  let updated = 0;
  let skipped = 0;
  const errors: { basket: string; reason: string }[] = [];

  for (const basket of baskets) {
    // recalculateBasketPerformance throws on an empty basket and on weights
    // that do not sum to 100. Neither is a job failure — they are drafts an
    // admin has not finished — so they are counted separately and stay quiet.
    if (basket._count.stocks === 0) {
      skipped++;
      continue;
    }

    try {
      await recalculateBasketPerformance(basket.id);
      updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/weights must sum|Add stocks/i.test(msg)) {
        skipped++;
        continue;
      }
      errors.push({ basket: `${basket.basketName} (#${basket.id})`, reason: msg });
      console.error(`[finuer-basket-perf] ${basket.basketName} (#${basket.id}):`, msg);
    }
  }

  return {
    checked: baskets.length,
    updated,
    skipped,
    failed: errors.length,
    ...(errors.length ? { errors: errors.slice(0, 10) } : {}),
  };
}
