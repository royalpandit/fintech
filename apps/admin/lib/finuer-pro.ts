import type { UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Finuer Pro — the platform-level subscription (as opposed to the per-advisor
 * subscription services).
 *
 * The catalog lives in the `finuer_plans` table so super-admin can edit pricing,
 * duration and the feature bullets without a redeploy. The constants below are
 * the *seed* and the *fallback*: on first read an empty table is lazily seeded
 * from them, and if the table doesn't exist yet (migration not run) every read
 * falls back to them so nothing 500s. Run `npm run db:finuer-plans` to create it.
 */

/** A plan's slug is its stable identity — it's what lands in
 *  `user_preferences.finuer_pro_plan_id`, so these three must keep their names. */
export type FinuerPlanId = string;

export type FinuerPlan = {
  id: FinuerPlanId;
  label: string;
  tagline: string | null;
  priceInr: number;
  /** null = forever / free */
  durationDays: number | null;
  features: string[];
  unlocksPremiumBaskets: boolean;
  isPurchasable: boolean;
  badge: string | null;
  sortOrder: number;
};

type PlanRow = {
  slug: string;
  label: string;
  tagline: string | null;
  priceInr: unknown;
  durationDays: number | null;
  features: string[];
  unlocksPremiumBaskets: boolean;
  isPurchasable: boolean;
  badge: string | null;
  sortOrder: number;
};

// ─── Code defaults (seed + fallback) ─────────────────────────────────────────

export const FINUER_PLAN_DEFAULTS: FinuerPlan[] = [
  {
    id: "free",
    label: "Free",
    tagline: "Everything you need to get started",
    priceInr: 0,
    durationDays: null,
    features: ["Public Finuer Baskets", "Markets overview", "Community feed"],
    unlocksPremiumBaskets: false,
    isPurchasable: false,
    badge: null,
    sortOrder: 0,
  },
  {
    id: "pro_monthly",
    label: "Finuer Pro · Monthly",
    tagline: "Full access, billed monthly",
    priceInr: 499,
    durationDays: 30,
    features: [
      "Everything in Free",
      "Premium Finuer Baskets (full holdings & returns)",
      "Pro-only competitions",
      "Priority support",
    ],
    unlocksPremiumBaskets: true,
    isPurchasable: true,
    badge: null,
    sortOrder: 1,
  },
  {
    id: "pro_yearly",
    label: "Finuer Pro · Yearly",
    tagline: "Two months free versus monthly",
    priceInr: 4999,
    durationDays: 365,
    features: [
      "Everything in Pro Monthly",
      "2 months free vs monthly",
      "Premium Finuer Baskets",
      "Pro-only competitions",
    ],
    unlocksPremiumBaskets: true,
    isPurchasable: true,
    badge: "Best value",
    sortOrder: 2,
  },
];

const FREE_FALLBACK: FinuerPlan =
  FINUER_PLAN_DEFAULTS.find((p) => p.id === "free") ?? FINUER_PLAN_DEFAULTS[0];

// ─── Catalog reads (cached) ──────────────────────────────────────────────────

function toPlan(row: PlanRow): FinuerPlan {
  return {
    id: row.slug,
    label: row.label,
    tagline: row.tagline,
    priceInr: Number(row.priceInr),
    durationDays: row.durationDays,
    features: row.features ?? [],
    unlocksPremiumBaskets: row.unlocksPremiumBaskets,
    isPurchasable: row.isPurchasable,
    badge: row.badge,
    sortOrder: row.sortOrder,
  };
}

const PLAN_SELECT = {
  slug: true,
  label: true,
  tagline: true,
  priceInr: true,
  durationDays: true,
  features: true,
  unlocksPremiumBaskets: true,
  isPurchasable: true,
  badge: true,
  sortOrder: true,
} as const;

// Two caches: `getFinuerPlan` (and therefore every premium-basket request)
// reads the includeInactive list, so it needs caching just as much as the
// user-facing active list.
type PlanCache = { plans: FinuerPlan[]; at: number } | null;
let activeCache: PlanCache = null;
let allCache: PlanCache = null;
const TTL_MS = 15_000;

/** Call after any admin edit so the next read sees fresh data. */
export function invalidateFinuerPlanCache() {
  activeCache = null;
  allCache = null;
}

/** Insert the code defaults the first time the table is seen empty. */
async function seedDefaults() {
  await prisma.finuerPlan.createMany({
    data: FINUER_PLAN_DEFAULTS.map((p) => ({
      slug: p.id,
      label: p.label,
      tagline: p.tagline,
      priceInr: p.priceInr,
      durationDays: p.durationDays,
      features: p.features,
      unlocksPremiumBaskets: p.unlocksPremiumBaskets,
      isPurchasable: p.isPurchasable,
      badge: p.badge,
      sortOrder: p.sortOrder,
    })),
    skipDuplicates: true,
  });
}

/**
 * Every active plan, cheapest first. `includeInactive` is for the super-admin
 * editor, which needs to see (and re-enable) plans it has switched off.
 */
export async function listFinuerPlans(opts?: {
  includeInactive?: boolean;
}): Promise<FinuerPlan[]> {
  const includeInactive = opts?.includeInactive ?? false;
  const cached = includeInactive ? allCache : activeCache;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.plans;

  try {
    let rows = (await prisma.finuerPlan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { priceInr: "asc" }],
      select: PLAN_SELECT,
    })) as PlanRow[];

    // First run after the migration — the table exists but is empty.
    if (rows.length === 0) {
      await seedDefaults();
      rows = (await prisma.finuerPlan.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { priceInr: "asc" }],
        select: PLAN_SELECT,
      })) as PlanRow[];
    }

    const plans = rows.map(toPlan);
    const entry = { plans, at: Date.now() };
    if (includeInactive) allCache = entry;
    else activeCache = entry;
    return plans;
  } catch {
    // Table not migrated yet — serve the code defaults so nothing breaks.
    return FINUER_PLAN_DEFAULTS;
  }
}

export async function getFinuerPlan(
  id: string | null | undefined,
): Promise<FinuerPlan | null> {
  if (!id) return null;
  // Look through inactive plans too: a user mid-term on a plan that was since
  // switched off must still resolve to their real entitlements.
  const plans = await listFinuerPlans({ includeInactive: true });
  return plans.find((p) => p.id === id) ?? null;
}

/** The plans a user can actually buy — what the pricing cards render. */
export async function listPurchasableFinuerPlans(): Promise<FinuerPlan[]> {
  return (await listFinuerPlans()).filter(
    (p) => p.isPurchasable && p.unlocksPremiumBaskets,
  );
}

async function freePlan(): Promise<FinuerPlan> {
  return (await getFinuerPlan("free")) ?? FREE_FALLBACK;
}

// ─── Entitlement ─────────────────────────────────────────────────────────────

export type FinuerProStatus = {
  active: boolean;
  planId: FinuerPlanId;
  plan: FinuerPlan;
  expiresAt: string | null;
  /** True for staff, who get Pro from their role rather than a grant. */
  viaRole: boolean;
};

/** Staff always have Pro. Users need an unexpired grant on user_preferences. */
export async function getFinuerProStatus(
  userId: number | null | undefined,
  role?: UserRole | null,
): Promise<FinuerProStatus> {
  const free = async (): Promise<FinuerProStatus> => {
    const plan = await freePlan();
    return { active: false, planId: plan.id, plan, expiresAt: null, viaRole: false };
  };

  if (role === "admin" || role === "super_admin") {
    const plans = await listFinuerPlans({ includeInactive: true });
    // Highest-tier Pro plan available, so staff see the full feature set.
    const staffPlan =
      [...plans].filter((p) => p.unlocksPremiumBaskets).sort((a, b) => b.priceInr - a.priceInr)[0] ??
      FINUER_PLAN_DEFAULTS[FINUER_PLAN_DEFAULTS.length - 1];
    return {
      active: true,
      planId: staffPlan.id,
      plan: staffPlan,
      expiresAt: null,
      viaRole: true,
    };
  }
  if (!userId) return free();

  try {
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
      select: { finuerProExpiresAt: true, finuerProPlanId: true },
    });
    const expiresAt = pref?.finuerProExpiresAt ?? null;
    if (!expiresAt || expiresAt.getTime() <= Date.now()) return free();

    const plan = (await getFinuerPlan(pref?.finuerProPlanId)) ?? null;
    if (!plan) return free();
    return {
      active: plan.unlocksPremiumBaskets,
      planId: plan.id,
      plan,
      expiresAt: expiresAt.toISOString(),
      viaRole: false,
    };
  } catch {
    // Column may not be migrated yet — fail closed (no Pro).
    return free();
  }
}

export async function userHasFinuerPro(
  userId: number | null | undefined,
  role?: UserRole | null,
): Promise<boolean> {
  return (await getFinuerProStatus(userId, role)).active;
}

// ─── Grant / revoke ──────────────────────────────────────────────────────────

export async function grantFinuerPro(opts: {
  userId: number;
  planId: FinuerPlanId;
  /** When set, absolute expiry. Otherwise durationDays from the plan. */
  expiresAt?: Date;
  /** Extend an existing unexpired grant instead of restarting the clock. */
  extend?: boolean;
}) {
  const plan = await getFinuerPlan(opts.planId);
  if (!plan || !plan.unlocksPremiumBaskets) {
    throw new Error("Choose a Pro plan (one that unlocks premium baskets)");
  }

  const days = plan.durationDays ?? 30;
  let from = Date.now();
  if (opts.extend && !opts.expiresAt) {
    const pref = await prisma.userPreference.findUnique({
      where: { userId: opts.userId },
      select: { finuerProExpiresAt: true },
    });
    const current = pref?.finuerProExpiresAt?.getTime() ?? 0;
    if (current > from) from = current;
  }
  const expiresAt = opts.expiresAt ?? new Date(from + days * 24 * 60 * 60 * 1000);

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

  return { planId: plan.id, plan, expiresAt };
}

export async function revokeFinuerPro(userId: number) {
  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, finuerProPlanId: null, finuerProExpiresAt: null },
    update: { finuerProPlanId: null, finuerProExpiresAt: null },
  });
}

// ─── Premium basket payload locking ──────────────────────────────────────────

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
    excessReturn: null,
    beta: null,
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
