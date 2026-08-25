import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  getFinuerPlan,
  getFinuerProStatus,
  grantFinuerPro,
  revokeFinuerPro,
} from "@/lib/finuer-pro";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * POST — self-serve Finuer Pro subscribe / renew / upgrade.
 *
 * Payments are not wired yet, so this follows the same convention as the other
 * purchase routes in this app (see api/v1/courses/[id]/purchase): the
 * entitlement is granted straight away and a `payments` row is written with
 * `provider: "dev_bypass"`. When Razorpay lands, the only change needed is to
 * create the order here and move the grant into the webhook — the entitlement
 * and receipt writes below are already the right shape for that.
 *
 * Renewing the plan you're already on *extends* the term rather than resetting
 * it, so nobody loses paid days by clicking early.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Sign in to subscribe", 401);

  const body = await parseBody<{ planId?: string }>(req);
  const planId = String(body.planId ?? "").trim();
  if (!planId) return err("planId is required");

  const plan = await getFinuerPlan(planId);
  if (!plan) return err("Plan not found", 404);
  if (!plan.isPurchasable || !plan.unlocksPremiumBaskets) {
    return err("That plan isn't available to buy");
  }

  const current = await getFinuerProStatus(auth.userId, auth.role);
  if (current.viaRole) {
    return err("Your staff account already includes Finuer Pro", 409);
  }

  // Same plan while still active → extend. Different plan → start fresh so the
  // user immediately gets the tier they just paid for.
  const isRenewal = current.active && current.planId === plan.id;

  const { expiresAt } = await grantFinuerPro({
    userId: auth.userId,
    planId: plan.id,
    extend: isRenewal,
  });

  // Receipt. Best-effort: a bookkeeping failure must not cost the user the
  // entitlement they just bought.
  let paymentId: number | null = null;
  try {
    const payment = await prisma.payment.create({
      data: {
        userId: auth.userId,
        kind: "finuer_pro",
        amount: plan.priceInr,
        status: "success",
        provider: "dev_bypass",
        referenceKind: "finuer_pro_plan",
        metadata: {
          planId: plan.id,
          planLabel: plan.label,
          durationDays: plan.durationDays,
          renewal: isRenewal,
          previousPlanId: current.active ? current.planId : null,
          expiresAt: expiresAt.toISOString(),
        },
      },
      select: { id: true },
    });
    paymentId = payment.id;
  } catch (e) {
    console.warn("[finuer-pro] receipt write failed: %s", (e as Error).message);
  }

  const until = expiresAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  await notify({
    userId: auth.userId,
    title: isRenewal ? "Finuer Pro renewed" : "Finuer Pro activated",
    message: `${plan.label} is active until ${until}. Premium Finuer Baskets are unlocked.`,
    data: { href: "/user/subscriptions#finuer-pro" },
  });

  return ok({
    subscribed: true,
    renewal: isRenewal,
    planId: plan.id,
    planLabel: plan.label,
    amount: plan.priceInr,
    expiresAt: expiresAt.toISOString(),
    paymentId,
    paymentPending: false,
  });
}

/** DELETE — cancel: drop the entitlement immediately. */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Sign in first", 401);

  const status = await getFinuerProStatus(auth.userId, auth.role);
  if (status.viaRole) return err("Staff Pro access can't be cancelled", 409);
  if (!status.active) return err("You don't have an active Finuer Pro plan", 409);

  await revokeFinuerPro(auth.userId);

  return ok({ cancelled: true });
}
