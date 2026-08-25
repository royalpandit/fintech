import { NextRequest } from "next/server";
import { ok } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { getFinuerProStatus, listFinuerPlans } from "@/lib/finuer-pro";

export const dynamic = "force-dynamic";

/**
 * GET — the public pricing catalog plus the caller's own Pro status. Used by the
 * Finuer Pro block on /user/subscriptions to refresh after a purchase without a
 * full page reload. Works unauthenticated (status comes back as Free).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  const [plans, status] = await Promise.all([
    listFinuerPlans(),
    getFinuerProStatus(auth?.userId ?? null, auth?.role ?? null),
  ]);

  return ok({
    plans,
    status: {
      active: status.active,
      planId: status.planId,
      planLabel: status.plan.label,
      expiresAt: status.expiresAt,
      viaRole: status.viaRole,
    },
  });
}
