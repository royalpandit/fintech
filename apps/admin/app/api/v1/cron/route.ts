import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { CRON_JOB_NAMES, isCronJobName, runCronJobs } from "@/lib/cron-jobs";

export const dynamic = "force-dynamic";
// Give the sweeps room — the price-alert pass fetches live quotes.
export const maxDuration = 60;

/**
 * Background job runner.
 *
 *   GET /api/v1/cron                  → run every job
 *   GET /api/v1/cron?job=price-alerts → run one
 *
 * Requires the CRON_SECRET shared secret (Bearer or x-cron-secret header).
 * Vercel Cron sends the Bearer form automatically; any external pinger or
 * `curl` can use either.
 */
async function handle(req: NextRequest) {
  const auth = authorizeCron(req);
  if (auth.ok !== true) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const raw = req.nextUrl.searchParams.get("job");
  if (raw && !isCronJobName(raw)) {
    return NextResponse.json(
      { ok: false, error: `Unknown job. Valid jobs: ${CRON_JOB_NAMES.join(", ")}` },
      { status: 400 },
    );
  }
  const requested = isCronJobName(raw) ? raw : undefined;

  const startedAt = new Date();
  const results = await runCronJobs(requested);
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json(
    {
      ok: failed.length === 0,
      ranAt: startedAt.toISOString(),
      totalMs: Date.now() - startedAt.getTime(),
      results,
    },
    // 207 when some jobs failed, so an uptime monitor can distinguish a
    // partial tick from a healthy one without parsing the body.
    { status: failed.length ? 207 : 200 },
  );
}

export const GET = handle;
export const POST = handle;
