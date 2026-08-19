import { prisma } from "@/lib/prisma";
import { fetchLiveLtp } from "@/lib/paper-market-quote";
import { notifyPriceAlert } from "@/lib/notify";
import { isMarketOpenNow } from "@/lib/nse-market-time";

/**
 * Price alert evaluation.
 *
 * `PriceAlert` existed in the schema with no code behind it at all — no create
 * route, no UI, no evaluator. This is the evaluator: it runs from the cron tick
 * (an alert must fire during market hours whether or not anyone has a page
 * open, so the opportunistic-sweep pattern can't work here).
 */

/** Alerts share symbols, so quote each distinct symbol once per pass. */
async function quoteSymbols(symbols: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  for (const symbol of symbols) {
    try {
      const ltp = await fetchLiveLtp({ symbol });
      if (Number.isFinite(ltp) && ltp > 0) prices.set(symbol, ltp);
    } catch {
      // Unknown/illiquid symbol or the feed is down — skip it this pass.
    }
  }
  return prices;
}

export function hasCrossed(direction: string, target: number, last: number): boolean {
  return direction === "above" ? last >= target : last <= target;
}

export async function evaluatePriceAlerts(): Promise<{
  checked: number;
  symbols: number;
  triggered: number;
  skipped?: string;
}> {
  // Quotes are stale outside market hours and the feed rate-limits, so don't burn
  // the budget — a crossing will be caught on the next open tick.
  if (!isMarketOpenNow()) {
    return { checked: 0, symbols: 0, triggered: 0, skipped: "market closed" };
  }

  const alerts = await prisma.priceAlert.findMany({
    where: { isTriggered: false },
    select: {
      id: true,
      userId: true,
      symbol: true,
      targetPrice: true,
      direction: true,
    },
  });
  if (!alerts.length) return { checked: 0, symbols: 0, triggered: 0 };

  const symbols = [...new Set(alerts.map((a) => a.symbol.trim().toUpperCase()))];
  const prices = await quoteSymbols(symbols);

  let triggered = 0;
  for (const alert of alerts) {
    const last = prices.get(alert.symbol.trim().toUpperCase());
    if (last == null) continue;

    const target = Number(alert.targetPrice);
    if (!hasCrossed(alert.direction, target, last)) continue;

    // Mark first, then notify — a duplicate notification is worse than a missed
    // one, and `isTriggered` is what stops this alert being picked up again.
    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: { isTriggered: true, triggeredAt: new Date() },
    });
    await notifyPriceAlert({
      userId: alert.userId,
      symbol: alert.symbol,
      targetPrice: target,
      direction: alert.direction,
      lastPrice: last,
    });
    triggered++;
  }

  return { checked: alerts.length, symbols: symbols.length, triggered };
}
