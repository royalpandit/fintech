import { prisma } from "@/lib/prisma";
import { notifySponsorshipLifecycle } from "@/lib/notify";
import { getSponsorshipTier } from "@/lib/sponsorship";

/**
 * Featured Analyst expiry lifecycle — advance warnings and a lapse notice.
 *
 * Placement itself is computed on read (`featuredUntil` compared to now), so
 * nothing here grants or removes visibility; it exists so an advisor finds out
 * *before* they drop off the top of Trades rather than noticing their traffic
 * fell off a cliff.
 *
 * Deliberately the same shape as lib/finuer-pro-sweep.ts: fixed milestones
 * rather than a daily nag, a distinct title per milestone so the 24h title
 * dedupe gives exactly one nudge each, and a short grace window after expiry so
 * a placement that ended months ago isn't re-announced on every cron tick.
 */

/** Days before expiry at which an advisor is nudged. */
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
 * notify-worthy day. 5 days left sits between the 7 and 3 milestones — silent.
 */
function milestoneFor(daysLeft: number): number | null {
  for (const m of WARN_AT_DAYS) {
    if (daysLeft === m) return m;
  }
  // Anything that slipped past a milestone without a tick (server down, a
  // 2-day admin grant) still gets a single nudge, at the NEAREST milestone
  // above it — Math.min, not Math.max. Math.max picked the furthest one, so an
  // advisor two days from expiry was told "ends in 7 days".
  const missed = WARN_AT_DAYS.filter((m) => daysLeft < m);
  return daysLeft > 0 && missed.length > 0 ? Math.min(...missed) : null;
}

const MILESTONE_TITLES: Record<7 | 3 | 1, string> = {
  7: "Featured placement expires next week",
  3: "Featured placement expires in a few days",
  1: "Featured placement expires tomorrow",
};

export type SponsorshipSweepResult = { checked: number; warned: number; lapsed: number };

/** Every advisor inside the warning window or just past expiry — for the cron. */
export async function sweepAllSponsorshipLifecycles(): Promise<SponsorshipSweepResult> {
  const totals: SponsorshipSweepResult = { checked: 0, warned: 0, lapsed: 0 };
  try {
    const now = new Date();
    const rows = await prisma.advisorProfile.findMany({
      where: {
        featuredUntil: {
          gte: new Date(now.getTime() - LAPSE_GRACE_DAYS * DAY_MS),
          lte: new Date(now.getTime() + Math.max(...WARN_AT_DAYS) * DAY_MS),
        },
      },
      select: { userId: true },
    });

    for (const r of rows) {
      const one = await sweepSponsorshipLifecycle(r.userId);
      totals.checked += one.checked;
      totals.warned += one.warned;
      totals.lapsed += one.lapsed;
    }
  } catch {
    // A missing column or an unreachable DB must not fail the whole cron tick.
  }
  return totals;
}

/** One advisor. Safe to call on every page render — it never throws. */
export async function sweepSponsorshipLifecycle(
  userId: number,
): Promise<SponsorshipSweepResult> {
  const result: SponsorshipSweepResult = { checked: 0, warned: 0, lapsed: 0 };
  try {
    const now = new Date();
    const profile = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: { featuredUntil: true, featuredTier: true },
    });
    const until = profile?.featuredUntil ?? null;
    if (!until) return result;

    const daysLeft = daysBetween(now, until);
    const lapsed = until.getTime() <= now.getTime();

    // Outside the window on either side — nothing to say.
    if (lapsed && now.getTime() - until.getTime() > LAPSE_GRACE_DAYS * DAY_MS) return result;
    if (!lapsed && daysLeft > Math.max(...WARN_AT_DAYS)) return result;

    result.checked = 1;

    const tier = await getSponsorshipTier(profile?.featuredTier);
    const tierLabel = tier?.label ?? "Featured Analyst";

    // AUTO-RENEW SEAM — once payments are wired, attempt the charge here and
    // return early on success (extending featuredUntil by tier.durationDays and
    // writing a `payments` row, exactly as grantSponsorship does). Only fall
    // through to the notices below when auto-renew is off or the charge fails,
    // so a renewing advisor never sees an "expiring" warning.

    const milestone = lapsed ? null : milestoneFor(daysLeft);
    if (!lapsed && milestone == null) return result;

    // One distinct title per bucket, so the 24h dedupe gives a single nudge per
    // milestone rather than one for the whole run-up. Deliberately phrased
    // rather than numbered: with a daily cron `daysLeft` almost never lands
    // exactly on 7/3/1, so a numbered title would routinely contradict the
    // exact figure in the body.
    const title = lapsed
      ? "Featured placement ended"
      : MILESTONE_TITLES[milestone as 7 | 3 | 1];

    const recent = await prisma.notification.findMany({
      where: { userId, createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) } },
      select: { title: true },
    });
    if (recent.some((r) => r.title === title)) return result;

    // The title carries the milestone so the dedupe above gives one nudge per
    // bucket; the body carries the REAL number of days, so a bucket that rounds
    // (2 days left bucketed to the 3-day nudge) never states a wrong figure.
    await notifySponsorshipLifecycle({
      userId,
      tierLabel,
      daysLeft: lapsed ? null : daysLeft,
      title,
    });

    if (lapsed) result.lapsed = 1;
    else result.warned = 1;
  } catch {
    // Never block a page render on the sweep.
  }
  return result;
}
