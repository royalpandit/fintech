import { prisma } from "@/lib/prisma";
import { notifySubscriptionLifecycle } from "@/lib/notify";

/**
 * Warn users whose subscriptions are about to lapse, and tell them once they
 * have. Runs opportunistically on page load (same pattern as
 * `publishDueScheduledPosts` / `sendDueBroadcasts`) rather than needing a cron.
 *
 * Deduplication is by notification title + a 24h window, so a user sitting on
 * the page doesn't collect a warning every render.
 */

const WARN_WITHIN_DAYS = 3;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Every user with a subscription lapsing soon — for the cron job. The per-user
 * version below only runs when that user happens to open the page, which meant
 * inactive users never got warned and their rows never expired.
 */
export async function sweepAllSubscriptionLifecycles(): Promise<{ users: number }> {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + WARN_WITHIN_DAYS * 24 * 60 * 60 * 1000);
    const rows = await prisma.subscription.findMany({
      where: { status: "active", endDate: { not: null, lte: horizon } },
      select: { userId: true },
      distinct: ["userId"],
    });
    for (const r of rows) await sweepSubscriptionLifecycle(r.userId);
    return { users: rows.length };
  } catch {
    return { users: 0 };
  }
}

export async function sweepSubscriptionLifecycle(userId: number): Promise<void> {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + WARN_WITHIN_DAYS * 24 * 60 * 60 * 1000);

    const subs = await prisma.subscription.findMany({
      where: {
        userId,
        status: "active",
        endDate: { not: null, lte: horizon },
      },
      select: {
        id: true,
        endDate: true,
        advisor: { select: { fullName: true } },
      },
    });
    if (!subs.length) return;

    // What have we already told them about in the last day?
    const recent = await prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
      },
      select: { title: true },
    });
    const alreadySent = new Set(recent.map((r) => r.title));

    for (const sub of subs) {
      if (!sub.endDate) continue;
      const advisorName = sub.advisor?.fullName ?? "your advisor";
      const daysLeft = daysBetween(now, sub.endDate);
      const lapsed = daysLeft <= 0;

      const title = lapsed
        ? `Your ${advisorName} subscription ended`
        : "Subscription expiring soon";
      if (alreadySent.has(title)) continue;
      alreadySent.add(title);

      await notifySubscriptionLifecycle({
        userId,
        advisorName,
        daysLeft: lapsed ? null : daysLeft,
      });

      // Flip the row once it's genuinely over so it stops granting access.
      if (lapsed) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "expired" },
        });
      }
    }
  } catch {
    // Never block a page render on the sweep.
  }
}
