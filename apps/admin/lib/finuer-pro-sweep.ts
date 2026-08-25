import { prisma } from "@/lib/prisma";
import { notifyFinuerProLifecycle } from "@/lib/notify";
import { getFinuerPlan } from "@/lib/finuer-pro";

/**
 * Finuer Pro expiry lifecycle — advance warnings and a lapse notice.
 *
 * Pro access itself is computed on read (`getFinuerProStatus` compares
 * `finuerProExpiresAt` to now), so nothing here grants or removes access; it
 * exists purely so a member finds out *before* their premium baskets lock
 * rather than discovering it by surprise.
 *
 * Warnings fire at fixed milestones (7 / 3 / 1 days) rather than daily, and each
 * milestone gets its own notification title so the 24h title dedupe below gives
 * exactly one nudge per milestone. Lapse notices only fire inside a short grace
 * window after the expiry date, so an account that expired months ago doesn't
 * get re-notified on every cron tick.
 *
 * Payments aren't wired yet. When they are, the `// AUTO-RENEW SEAM` block below
 * is where a charge attempt belongs: try the card first, and only fall through
 * to the warning/lapse notices when it fails or auto-renew is off.
 */

/** Days before expiry at which a member is nudged. */
const WARN_AT_DAYS = [7, 3, 1] as const;
/** How long after expiry we still send the "ended" notice. */
const LAPSE_GRACE_DAYS = 2;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `from` to `to`, rounded up. Negative once `to` has passed. */
function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * The milestone a given remaining-days value maps to, or null when it isn't a
 * notify-worthy day. 5 days left is between the 7 and 3 milestones — silent.
 */
function milestoneFor(daysLeft: number): number | null {
  for (const m of WARN_AT_DAYS) {
    if (daysLeft === m) return m;
  }
  // Anything that slipped past a milestone without a tick (server down, a plan
  // granted for 2 days) still gets the nearest smaller milestone once.
  const missed = WARN_AT_DAYS.filter((m) => daysLeft < m);
  return daysLeft > 0 && missed.length > 0 ? Math.max(...missed) : null;
}

export type FinuerProSweepResult = { checked: number; warned: number; lapsed: number };

/**
 * Every member inside the warning window or just past expiry — for the cron job.
 * The per-user version below only runs when that member happens to open the
 * Subscriptions page, which is exactly the population least likely to.
 */
export async function sweepAllFinuerProLifecycles(): Promise<FinuerProSweepResult> {
  const totals: FinuerProSweepResult = { checked: 0, warned: 0, lapsed: 0 };
  try {
    const now = new Date();
    const rows = await prisma.userPreference.findMany({
      where: {
        finuerProExpiresAt: {
          gte: new Date(now.getTime() - LAPSE_GRACE_DAYS * DAY_MS),
          lte: new Date(now.getTime() + Math.max(...WARN_AT_DAYS) * DAY_MS),
        },
      },
      select: { userId: true },
    });

    for (const r of rows) {
      const one = await sweepFinuerProLifecycle(r.userId);
      totals.checked += one.checked;
      totals.warned += one.warned;
      totals.lapsed += one.lapsed;
    }
  } catch {
    // A missing column or an unreachable DB must not fail the whole cron tick.
  }
  return totals;
}

/** One member. Safe to call on every page render — it never throws. */
export async function sweepFinuerProLifecycle(
  userId: number,
): Promise<FinuerProSweepResult> {
  const result: FinuerProSweepResult = { checked: 0, warned: 0, lapsed: 0 };
  try {
    const now = new Date();
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
      select: { finuerProPlanId: true, finuerProExpiresAt: true },
    });
    const expiresAt = pref?.finuerProExpiresAt ?? null;
    if (!expiresAt) return result;

    const daysLeft = daysBetween(now, expiresAt);
    const lapsed = expiresAt.getTime() <= now.getTime();

    // Outside the window on either side — nothing to say.
    if (lapsed && now.getTime() - expiresAt.getTime() > LAPSE_GRACE_DAYS * DAY_MS) return result;
    if (!lapsed && daysLeft > Math.max(...WARN_AT_DAYS)) return result;

    result.checked = 1;

    const plan = await getFinuerPlan(pref?.finuerProPlanId);
    const planLabel = plan?.label ?? "Finuer Pro";

    // AUTO-RENEW SEAM — once payments are wired, attempt the charge here and
    // return early on success (extending finuerProExpiresAt by plan.durationDays
    // and writing a `payments` row, exactly as the subscribe route does). Only
    // fall through to the notices below when auto-renew is off or the charge
    // fails, so a renewing member never sees an "expiring" warning.

    const milestone = lapsed ? null : milestoneFor(daysLeft);
    if (!lapsed && milestone == null) return result;

    // Distinct titles per milestone, so the 24h dedupe gives one nudge each
    // rather than one nudge total for the whole run-up.
    const title = lapsed
      ? "Finuer Pro ended"
      : `Finuer Pro expires in ${milestone} day${milestone === 1 ? "" : "s"}`;

    const recent = await prisma.notification.findMany({
      where: { userId, createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) } },
      select: { title: true },
    });
    if (recent.some((r) => r.title === title)) return result;

    await notifyFinuerProLifecycle({
      userId,
      planLabel,
      daysLeft: lapsed ? null : milestone,
      title,
    });

    if (lapsed) result.lapsed = 1;
    else result.warned = 1;
  } catch {
    // Never block a page render on the sweep.
  }
  return result;
}
