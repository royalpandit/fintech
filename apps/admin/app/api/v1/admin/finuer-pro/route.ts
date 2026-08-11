import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import {
  FINUER_PLANS,
  getFinuerPlan,
  grantFinuerPro,
  listFinuerPlans,
  revokeFinuerPro,
  type FinuerPlanId,
} from "@/lib/finuer-pro";

export const dynamic = "force-dynamic";

/** GET — plan catalog + users with active Finuer Pro */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin", "admin"]);
  if (!auth) return err("Forbidden", 403);

  const now = new Date();
  const active = await prisma.userPreference.findMany({
    where: { finuerProExpiresAt: { gt: now } },
    select: {
      userId: true,
      finuerProPlanId: true,
      finuerProExpiresAt: true,
      user: { select: { id: true, fullName: true, email: true, role: true } },
    },
    orderBy: { finuerProExpiresAt: "asc" },
    take: 200,
  });

  return ok({
    plans: listFinuerPlans(),
    members: active.map((r) => ({
      userId: r.userId,
      fullName: r.user.fullName,
      email: r.user.email,
      role: r.user.role,
      planId: r.finuerProPlanId,
      planLabel: getFinuerPlan(r.finuerProPlanId)?.label ?? r.finuerProPlanId,
      expiresAt: r.finuerProExpiresAt?.toISOString() ?? null,
    })),
  });
}

/** POST — grant or revoke Finuer Pro for a user (manual until Razorpay). */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin", "admin"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{
    action?: "grant" | "revoke";
    userId?: number;
    email?: string;
    planId?: string;
    days?: number;
  }>(req);

  const action = body.action ?? "grant";
  let userId = Number(body.userId);
  if (!Number.isFinite(userId) && body.email) {
    const u = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!u) return err("User not found", 404);
    userId = u.id;
  }
  if (!Number.isFinite(userId)) return err("userId or email is required");

  if (action === "revoke") {
    await revokeFinuerPro(userId);
    return ok({ revoked: true, userId });
  }

  const planId = (body.planId ?? "pro_monthly") as FinuerPlanId;
  if (!FINUER_PLANS[planId]?.unlocksPremiumBaskets) {
    return err("planId must be pro_monthly or pro_yearly");
  }

  const days =
    typeof body.days === "number" && body.days > 0
      ? Math.round(body.days)
      : FINUER_PLANS[planId].durationDays ?? 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const result = await grantFinuerPro({ userId, planId, expiresAt });
  return ok({ granted: true, userId, ...result, expiresAt: result.expiresAt.toISOString() });
}
