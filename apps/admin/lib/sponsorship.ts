import { prisma } from "@/lib/prisma";

/**
 * Sponsorship — the paid "Featured Analyst" placement that lifts an advisor to
 * the top of /user/trades and into the featured rail on /user/advisors.
 *
 * Entitlement itself is still just `advisorProfile.featuredUntil` compared to
 * now, exactly as before; nothing about how placement is *read* has changed.
 * What this module adds is the half that was missing:
 *
 *   - the tier catalog lives in `sponsorship_tiers`, so pricing and duration are
 *     editable from super-admin rather than hardcoded in a client component,
 *   - every grant writes a `payments` row, so sponsorship revenue is recorded
 *     and reportable instead of being invisible,
 *   - super-admin can grant, extend and revoke.
 *
 * Payments are still bypassed at the gateway level — `provider: "dev_bypass"`,
 * matching the Finuer Pro subscribe route. See PAYMENT SEAM below.
 *
 * Run `npm run db:sponsorship-tiers` once to create the table; until then every
 * read falls back to the code defaults so nothing 500s.
 */

/** A tier's slug is its stable identity — it is what lands in
 *  `advisor_profiles.featured_tier`, so these three must keep their names. */
export type SponsorshipTierId = string;

export type SponsorshipTier = {
  id: SponsorshipTierId;
  label: string;
  tagline: string | null;
  priceInr: number;
  durationDays: number;
  isPurchasable: boolean;
  badge: string | null;
  sortOrder: number;
};

type TierRow = {
  slug: string;
  label: string;
  tagline: string | null;
  priceInr: unknown;
  durationDays: number;
  isPurchasable: boolean;
  badge: string | null;
  sortOrder: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Code defaults (seed + fallback) ─────────────────────────────────────────

export const SPONSORSHIP_TIER_DEFAULTS: SponsorshipTier[] = [
  {
    id: "weekly",
    label: "1 week",
    tagline: "Try a featured slot",
    priceInr: 999,
    durationDays: 7,
    isPurchasable: true,
    badge: null,
    sortOrder: 0,
  },
  {
    id: "monthly",
    label: "1 month",
    tagline: "Steady visibility on Trades",
    priceInr: 2999,
    durationDays: 30,
    isPurchasable: true,
    badge: null,
    sortOrder: 1,
  },
  {
    id: "quarterly",
    label: "3 months",
    tagline: "Best rate per day",
    priceInr: 7499,
    durationDays: 90,
    isPurchasable: true,
    badge: "Best value",
    sortOrder: 2,
  },
];

// ─── Catalog reads (cached) ──────────────────────────────────────────────────

function toTier(row: TierRow): SponsorshipTier {
  return {
    id: row.slug,
    label: row.label,
    tagline: row.tagline,
    priceInr: Number(row.priceInr),
    durationDays: row.durationDays,
    isPurchasable: row.isPurchasable,
    badge: row.badge,
    sortOrder: row.sortOrder,
  };
}

const TIER_SELECT = {
  slug: true,
  label: true,
  tagline: true,
  priceInr: true,
  durationDays: true,
  isPurchasable: true,
  badge: true,
  sortOrder: true,
} as const;

type TierCache = { tiers: SponsorshipTier[]; at: number } | null;
let activeCache: TierCache = null;
let allCache: TierCache = null;
const TTL_MS = 15_000;

/** Call after any admin edit so the next read sees fresh data. */
export function invalidateSponsorshipTierCache() {
  activeCache = null;
  allCache = null;
}

async function seedDefaults() {
  await prisma.sponsorshipTier.createMany({
    data: SPONSORSHIP_TIER_DEFAULTS.map((t) => ({
      slug: t.id,
      label: t.label,
      tagline: t.tagline,
      priceInr: t.priceInr,
      durationDays: t.durationDays,
      isPurchasable: t.isPurchasable,
      badge: t.badge,
      sortOrder: t.sortOrder,
    })),
    skipDuplicates: true,
  });
}

/**
 * Every active tier, cheapest first. `includeInactive` is for the super-admin
 * editor, which needs to see (and re-enable) tiers it has switched off.
 */
export async function listSponsorshipTiers(opts?: {
  includeInactive?: boolean;
}): Promise<SponsorshipTier[]> {
  const includeInactive = opts?.includeInactive ?? false;
  const cached = includeInactive ? allCache : activeCache;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.tiers;

  try {
    const where = includeInactive ? {} : { isActive: true };
    const orderBy = [{ sortOrder: "asc" as const }, { priceInr: "asc" as const }];

    let rows = (await prisma.sponsorshipTier.findMany({
      where,
      orderBy,
      select: TIER_SELECT,
    })) as TierRow[];

    // First run after the migration — the table exists but is empty.
    if (rows.length === 0) {
      await seedDefaults();
      rows = (await prisma.sponsorshipTier.findMany({
        where,
        orderBy,
        select: TIER_SELECT,
      })) as TierRow[];
    }

    const tiers = rows.map(toTier);
    const entry = { tiers, at: Date.now() };
    if (includeInactive) allCache = entry;
    else activeCache = entry;
    return tiers;
  } catch {
    // Table not migrated yet — serve the code defaults so nothing breaks.
    return SPONSORSHIP_TIER_DEFAULTS;
  }
}

export async function getSponsorshipTier(
  id: string | null | undefined,
): Promise<SponsorshipTier | null> {
  if (!id) return null;
  // Inactive tiers included: an advisor mid-placement on a tier that was since
  // switched off must still resolve to a real label and price.
  const tiers = await listSponsorshipTiers({ includeInactive: true });
  return tiers.find((t) => t.id === id) ?? null;
}

/** The tiers an advisor can actually buy — what the purchase cards render. */
export async function listPurchasableSponsorshipTiers(): Promise<SponsorshipTier[]> {
  return (await listSponsorshipTiers()).filter((t) => t.isPurchasable);
}

// ─── Entitlement ─────────────────────────────────────────────────────────────

export type SponsorshipStatus = {
  featured: boolean;
  featuredUntil: string | null;
  tierId: SponsorshipTierId | null;
  tier: SponsorshipTier | null;
  /** Whole days left, 0 once lapsed. */
  daysLeft: number;
};

export async function getSponsorshipStatus(
  userId: number | null | undefined,
): Promise<SponsorshipStatus> {
  const none: SponsorshipStatus = {
    featured: false,
    featuredUntil: null,
    tierId: null,
    tier: null,
    daysLeft: 0,
  };
  if (!userId) return none;

  try {
    const profile = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: { featuredUntil: true, featuredTier: true },
    });
    const until = profile?.featuredUntil ?? null;
    const tier = await getSponsorshipTier(profile?.featuredTier);

    if (!until || until.getTime() <= Date.now()) {
      return {
        ...none,
        featuredUntil: until?.toISOString() ?? null,
        tierId: profile?.featuredTier ?? null,
        tier,
      };
    }

    return {
      featured: true,
      featuredUntil: until.toISOString(),
      tierId: profile?.featuredTier ?? null,
      tier,
      daysLeft: Math.max(0, Math.ceil((until.getTime() - Date.now()) / DAY_MS)),
    };
  } catch {
    return none;
  }
}

// ─── Grant / revoke ──────────────────────────────────────────────────────────

export type GrantSource = "purchase" | "admin_grant";

/**
 * Extend (or start) an advisor's featured placement.
 *
 * Always extends from the later of now and the current expiry, so buying twice
 * stacks rather than truncating. A `payments` row is written for every grant —
 * a purchase at the tier's list price, an admin grant at 0 with the acting
 * admin recorded — so revenue reporting reflects what was actually charged.
 */
export async function grantSponsorship(opts: {
  userId: number;
  tierId: SponsorshipTierId;
  source: GrantSource;
  /** Super-admin id, when source is "admin_grant". */
  actorAdminId?: number | null;
  /** Absolute expiry, overriding the tier duration (admin only). */
  expiresAt?: Date;
}) {
  const tier = await getSponsorshipTier(opts.tierId);
  if (!tier) throw new Error("Unknown sponsorship tier");
  if (opts.source === "purchase" && !tier.isPurchasable) {
    throw new Error("That tier is not available for purchase");
  }

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: opts.userId },
    select: { featuredUntil: true },
  });
  if (!profile) throw new Error("Advisor profile not found");

  let from = Date.now();
  const current = profile.featuredUntil?.getTime() ?? 0;
  if (current > from) from = current;
  const featuredUntil = opts.expiresAt ?? new Date(from + tier.durationDays * DAY_MS);

  const updated = await prisma.advisorProfile.update({
    where: { userId: opts.userId },
    data: { featuredUntil, featuredTier: tier.id },
    select: { featuredUntil: true, featuredTier: true },
  });

  // PAYMENT SEAM — when a gateway lands, create the order BEFORE the update
  // above and only apply the placement on a verified webhook, then swap
  // `provider` and set `providerPaymentId`. The row shape here is already final.
  const amount = opts.source === "purchase" ? tier.priceInr : 0;
  await prisma.payment
    .create({
      data: {
        userId: opts.userId,
        kind: "featured_placement",
        amount,
        currency: "INR",
        status: "success",
        provider: opts.source === "purchase" ? "dev_bypass" : "admin_grant",
        referenceKind: "advisor_profile",
        referenceId: opts.userId,
        metadata: {
          tier: tier.id,
          tierLabel: tier.label,
          days: tier.durationDays,
          featuredUntil: featuredUntil.toISOString(),
          source: opts.source,
          ...(opts.actorAdminId ? { grantedByAdminId: opts.actorAdminId } : {}),
        },
      },
    })
    // The placement is what the advisor paid for; a failed ledger write must not
    // roll it back. Log loudly instead so the gap is visible.
    .catch((e) => {
      console.error("[sponsorship] payment row failed", e);
    });

  return { tier, featuredUntil: updated.featuredUntil, tierId: updated.featuredTier };
}

export async function revokeSponsorship(userId: number) {
  await prisma.advisorProfile.update({
    where: { userId },
    data: { featuredUntil: null, featuredTier: null },
  });
}

// ─── Reporting ───────────────────────────────────────────────────────────────

export type FeaturedAdvisorRow = {
  userId: number;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
  featuredUntil: string | null;
  tierId: string | null;
  tierLabel: string | null;
  daysLeft: number;
  active: boolean;
};

/** Everyone with a placement — active first, then recently lapsed. */
export async function listFeaturedAdvisors(opts?: {
  includeLapsed?: boolean;
}): Promise<FeaturedAdvisorRow[]> {
  const includeLapsed = opts?.includeLapsed ?? true;
  const now = Date.now();
  try {
    const rows = await prisma.advisorProfile.findMany({
      where: includeLapsed
        ? { featuredUntil: { not: null } }
        : { featuredUntil: { gt: new Date() } },
      orderBy: { featuredUntil: "desc" },
      select: {
        userId: true,
        profileImageUrl: true,
        featuredUntil: true,
        featuredTier: true,
        user: { select: { fullName: true, email: true } },
      },
    });

    const tiers = await listSponsorshipTiers({ includeInactive: true });
    const label = new Map(tiers.map((t) => [t.id, t.label]));

    return rows.map((r) => {
      const until = r.featuredUntil;
      const active = Boolean(until && until.getTime() > now);
      return {
        userId: r.userId,
        fullName: r.user.fullName,
        email: r.user.email,
        profileImageUrl: r.profileImageUrl,
        featuredUntil: until ? until.toISOString() : null,
        tierId: r.featuredTier,
        tierLabel: r.featuredTier ? (label.get(r.featuredTier) ?? r.featuredTier) : null,
        daysLeft: active && until ? Math.max(0, Math.ceil((until.getTime() - now) / DAY_MS)) : 0,
        active,
      };
    });
  } catch {
    return [];
  }
}

export type SponsorshipRevenue = {
  total: number;
  last30d: number;
  purchases: number;
  comped: number;
};

/**
 * Recorded sponsorship revenue. Only real purchases count toward money — admin
 * grants are logged at 0 under `provider: "admin_grant"` and counted separately,
 * so comping a placement never inflates the revenue figure.
 */
export async function getSponsorshipRevenue(): Promise<SponsorshipRevenue> {
  const empty: SponsorshipRevenue = { total: 0, last30d: 0, purchases: 0, comped: 0 };
  try {
    const rows = await prisma.payment.findMany({
      where: { kind: "featured_placement", status: "success" },
      select: { amount: true, provider: true, createdAt: true },
    });
    const cutoff = Date.now() - 30 * DAY_MS;
    return rows.reduce(
      (acc, r) => {
        if (r.provider === "admin_grant") {
          acc.comped += 1;
          return acc;
        }
        const amt = Number(r.amount);
        acc.purchases += 1;
        acc.total += amt;
        if (r.createdAt.getTime() >= cutoff) acc.last30d += amt;
        return acc;
      },
      { ...empty },
    );
  } catch {
    return empty;
  }
}
