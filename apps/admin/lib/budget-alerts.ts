import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

/**
 * Budget breach detection.
 *
 * "Budget breach alerts" is one of the notification categories in settings, but
 * nothing ever produced a notification for it. A breach is month-to-date debit
 * spend in a category exceeding that category's `Budget.monthlyLimit`.
 */

/** "2026-08" — the key format `Budget.monthKey` uses. */
export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthRange(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 1)),
  };
}

/**
 * Check the budget covering a transaction's category and notify on a crossing.
 *
 * Fires only on the transaction that *crosses* the limit, not on every one
 * after it — otherwise a user over budget would be notified on every purchase
 * for the rest of the month.
 */
export async function checkBudgetBreach(params: {
  userId: number;
  categoryId: number | null;
  occurredAt: Date;
  amount: number;
}): Promise<void> {
  try {
    const monthKey = monthKeyOf(params.occurredAt);

    // A category budget wins; otherwise fall back to the user's overall budget
    // (stored with categoryId = null).
    const budget = await prisma.budget.findFirst({
      where: {
        userId: params.userId,
        monthKey,
        ...(params.categoryId != null
          ? { OR: [{ categoryId: params.categoryId }, { categoryId: null }] }
          : { categoryId: null }),
      },
      orderBy: { categoryId: "desc" }, // prefer the specific one over the null row
      include: { category: { select: { name: true } } },
    });
    if (!budget) return;

    const { start, end } = monthRange(monthKey);
    const spend = await prisma.transaction.aggregate({
      where: {
        userId: params.userId,
        txnType: "debit",
        occurredAt: { gte: start, lt: end },
        ...(budget.categoryId != null ? { categoryId: budget.categoryId } : {}),
      },
      _sum: { amount: true },
    });

    const total = Number(spend._sum.amount ?? 0);
    const limit = Number(budget.monthlyLimit);
    if (total <= limit) return;

    // Was it already over *before* this transaction? Then the crossing has
    // already been announced and this is just more spend on top.
    if (total - params.amount > limit) return;

    const label = budget.category?.name ?? "your monthly";
    const over = total - limit;
    await notify({
      userId: params.userId,
      title: `Over budget on ${label}`,
      message:
        `You've spent ₹${total.toLocaleString("en-IN")} against a ` +
        `₹${limit.toLocaleString("en-IN")} limit — ₹${over.toLocaleString("en-IN")} over.`,
      data: { kind: "budget", monthKey, href: "/user/wallet" },
    });
  } catch {
    // Never fail recording a transaction because the check failed.
  }
}
