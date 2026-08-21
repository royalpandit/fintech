import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { getForexRates } from "@/lib/forex";

export const dynamic = "force-dynamic";

// Live FX vs INR. Rate table and provider failover live in lib/forex.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  try {
    const { rates, source, fetchedAt, stale } = await getForexRates();
    return ok({ rates, source, base: "INR", fetchedAt, stale });
  } catch {
    return err("Couldn't reach the currency data source.", 502);
  }
}
