import { ok, err } from "@/lib/api-helpers";
import { getForexRates, TICKER_PAIRS } from "@/lib/forex";

export const dynamic = "force-dynamic";

/**
 * Public FX snapshot for the marketing page ticker — a handful of majors only.
 * The full table stays behind auth at /api/v1/market/currencies. The upstream
 * feeds are keyless public data, so nothing sensitive is exposed here, and the
 * 10-minute cache in lib/forex means this can't be used to hammer them.
 */
export async function GET() {
  try {
    const { rates, source, fetchedAt } = await getForexRates();
    const picked = TICKER_PAIRS.map((code) => rates.find((r) => r.code === code)).filter(
      (r): r is NonNullable<typeof r> => Boolean(r),
    );
    return ok({ rates: picked, base: "INR", source, fetchedAt });
  } catch {
    return err("Couldn't reach the currency data source.", 502);
  }
}
