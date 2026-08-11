import type { UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Platform plans managed by super-admin (display + entitlements). Payments not wired yet. */
export type FinuerPlanId = "free" | "pro_monthly" | "pro_yearly";

export type FinuerPlan = {
  id: FinuerPlanId;
  label: string;
  priceInr: number;
  durationDays: number | null; // null = forever / free
  features: string[];
  unlocksPremiumBaskets: boolean;
};

export const FINUER_PLANS: Record<FinuerPlanId, FinuerPlan> = {
  free: {
    id: "free",
    label: "Free",
    priceInr: 0,
    durationDays: null,
    features: ["Public Finuer Baskets", "Markets overview", "Community feed"],
    unlocksPremiumBaskets: false,
  },
  pro_monthly: {
    id: "pro_monthly",
    label: "Finuer Pro · Monthly",
    priceInr: 499,
    durationDays: 30,
    features: [
      "Everything in Free",
      "Premium Finuer Baskets (full holdings & returns)",
      "Pro-only competitions",
      "Priority support",
    ],
    unlocksPremiumBaskets: true,
  },
  pro_yearly: {
    id: "pro_yearly",
    label: "Finuer Pro · Yearly",
    priceInr: 4999,
    durationDays: 365,
    features: [
      "Everything in Pro Monthly",
      "2 months free vs monthly",
      "Premium Finuer Baskets",
      "Pro-only competitions",
    ],
    unlocksPremiumBaskets: true,
  },
};

export function listFinuerPlans(): FinuerPlan[] {
  return Object.values(FINUER_PLANS);
}

export function getFinuerPlan(id: string | null | undefined): FinuerPlan | null {
  if (!id) return null;
  return FINUER_PLANS[id as FinuerPlanId] ?? null;
}

export type FinuerProStatus = {
  active: boolean;
  planId: FinuerPlanId;
  plan: FinuerPlan;
  expiresAt: string | null;
};

/** Staff always have Pro. Users need an unexpired grant on user_preferences. */
export async function getFinuerProStatus(
  userId: number | null | undefined,
  role?: UserRole | null,
): Promise<FinuerProStatus> {
  const free = { active: false, planId: "free" as const, plan: FINUER_PLANS.free, expiresAt: null };

  if (role === "admin" || role === "super_admin") {
    return {
      active: true,
      planId: "pro_yearly",
      plan: FINUER_PLANS.pro_yearly,
      expiresAt: null,
    };
  }
  if (!userId) return free;

  try {
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
      select: { finuerProExpiresAt: true, finuerProPlanId: true },
    });
    const expiresAt = pref?.finuerProExpiresAt ?? null;
    if (!expiresAt || expiresAt.getTime() <= Date.now()) return free;

    const planId = (pref?.finuerProPlanId as FinuerPlanId) || "pro_monthly";
    const plan = getFinuerPlan(planId) ?? FINUER_PLANS.pro_monthly;
    return {
      active: plan.unlocksPremiumBaskets,
      planId: plan.id,
      plan,
      expiresAt: expiresAt.toISOString(),
    };
  } catch {
    // Column may not be migrated yet — fail closed (no Pro).
    return free;
  }
}

export async function userHasFinuerPro(
  userId: number | null | undefined,
  role?: UserRole | null,
): Promise<boolean> {
  return (await getFinuerProStatus(userId, role)).active;
}

export async function grantFinuerPro(opts: {
  userId: number;
  planId: FinuerPlanId;
  /** When set, absolute expiry. Otherwise durationDays from plan. */
  expiresAt?: Date;
}) {
  const plan = getFinuerPlan(opts.planId);
  if (!plan || !plan.unlocksPremiumBaskets) {
    throw new Error("Choose a Pro plan (monthly or yearly)");
  }
  const expiresAt =
    opts.expiresAt ??
    new Date(Date.now() + (plan.durationDays ?? 30) * 24 * 60 * 60 * 1000);

  await prisma.userPreference.upsert({
    where: { userId: opts.userId },
    create: {
      userId: opts.userId,
      finuerProPlanId: plan.id,
      finuerProExpiresAt: expiresAt,
    },
    update: {
      finuerProPlanId: plan.id,
      finuerProExpiresAt: expiresAt,
    },
  });

  return { planId: plan.id, expiresAt };
}

export async function revokeFinuerPro(userId: number) {
  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, finuerProPlanId: null, finuerProExpiresAt: null },
    update: { finuerProPlanId: null, finuerProExpiresAt: null },
  });
}

/** Strip sensitive premium basket fields for locked viewers. */
export function lockPremiumBasketPayload<T extends Record<string, unknown>>(
  basket: T,
  unlocked: boolean,
): T & { locked?: boolean } {
  if (unlocked || basket.requiredPlan !== "premium") {
    return { ...basket, locked: false };
  }

  const lockedPerf = {
    oneMonthReturn: null,
    threeMonthReturn: null,
    sixMonthReturn: null,
    oneYearReturn: null,
    threeYearReturn: null,
    fiveYearReturn: null,
    sinceLaunchReturn: null,
    basketReturn: null,
    benchmarkReturn: null,
    alpha: null,
    performanceStatus: "underperforming",
  };

  return {
    ...basket,
    locked: true,
    methodology: null,
    stocks: undefined,
    rebalanceEvents: undefined,
    performance: lockedPerf,
    shortDescription: basket.shortDescription
      ? String(basket.shortDescription).slice(0, 80)
      : null,
  };
}
