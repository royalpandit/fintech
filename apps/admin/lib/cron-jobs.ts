import { publishDueScheduledPosts } from "@/lib/scheduled-posts";
import { sendDueBroadcasts } from "@/lib/broadcast";
import { sweepAllSubscriptionLifecycles } from "@/lib/subscription-sweep";
import { sweepCompetitionStatuses } from "@/lib/competition-lifecycle";
import { evaluatePriceAlerts } from "@/lib/price-alert-engine";
import { sendNotificationDigests } from "@/lib/email-digest";

/**
 * Background jobs, driven by /api/v1/cron.
 *
 * Before this, every one of these ran opportunistically on page load — so
 * scheduled posts published whenever the next visitor happened to arrive, and
 * subscription expiry never fired for users who weren't browsing. Price alerts
 * were impossible to build at all.
 */

export type CronJobName =
  | "scheduled-posts"
  | "broadcasts"
  | "subscriptions"
  | "competitions"
  | "price-alerts"
  | "email-digest";

export type CronJobResult = {
  job: CronJobName;
  ok: boolean;
  ms: number;
  detail?: unknown;
  error?: string;
};

type Job = { name: CronJobName; run: () => Promise<unknown> };

const JOBS: Job[] = [
  { name: "scheduled-posts", run: publishDueScheduledPosts },
  { name: "broadcasts", run: sendDueBroadcasts },
  { name: "subscriptions", run: sweepAllSubscriptionLifecycles },
  { name: "competitions", run: sweepCompetitionStatuses },
  { name: "price-alerts", run: evaluatePriceAlerts },
  { name: "email-digest", run: sendNotificationDigests },
];

export const CRON_JOB_NAMES = JOBS.map((j) => j.name);

export function isCronJobName(v: string | null | undefined): v is CronJobName {
  return typeof v === "string" && CRON_JOB_NAMES.includes(v as CronJobName);
}

/**
 * Run one job or all of them. Each is isolated — one failing job must not stop
 * the rest, since they all share a single cron tick.
 */
export async function runCronJobs(only?: CronJobName): Promise<CronJobResult[]> {
  const selected = only ? JOBS.filter((j) => j.name === only) : JOBS;
  const results: CronJobResult[] = [];

  for (const job of selected) {
    const started = Date.now();
    try {
      const detail = await job.run();
      results.push({ job: job.name, ok: true, ms: Date.now() - started, detail });
    } catch (e) {
      results.push({
        job: job.name,
        ok: false,
        ms: Date.now() - started,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return results;
}
