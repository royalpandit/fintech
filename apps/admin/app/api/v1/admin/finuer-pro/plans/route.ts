import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { invalidateFinuerPlanCache, listFinuerPlans } from "@/lib/finuer-pro";

export const dynamic = "force-dynamic";

/**
 * Super-admin CRUD over the Finuer Pro plan catalog (`finuer_plans`). Editing a
 * plan here changes the pricing cards on /user/subscriptions immediately — no
 * redeploy. Run `npm run db:finuer-plans` once to create the table.
 */

type PlanBody = {
  slug?: string;
  label?: string;
  tagline?: string | null;
  priceInr?: number | string;
  durationDays?: number | string | null;
  features?: unknown;
  unlocksPremiumBaskets?: boolean;
  isPurchasable?: boolean;
  isActive?: boolean;
  badge?: string | null;
  sortOrder?: number | string;
};

const SLUG_RE = /^[a-z0-9_]{2,40}$/;

function cleanFeatures(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  const arr = Array.isArray(v) ? v : String(v).split("\n");
  return arr
    .map((f) => String(f).trim())
    .filter(Boolean)
    .slice(0, 20);
}

function toInt(v: unknown): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

function toMoney(v: unknown): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

function trimOrNull(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

/** GET — the whole catalog, inactive plans included, for the editor. */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin", "admin"]);
  if (!auth) return err("Forbidden", 403);

  try {
    const plans = await prisma.finuerPlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { priceInr: "asc" }],
    });
    return ok({
      plans: plans.map((p) => ({
        id: p.id,
        slug: p.slug,
        label: p.label,
        tagline: p.tagline,
        priceInr: Number(p.priceInr),
        durationDays: p.durationDays,
        features: p.features,
        unlocksPremiumBaskets: p.unlocksPremiumBaskets,
        isPurchasable: p.isPurchasable,
        isActive: p.isActive,
        badge: p.badge,
        sortOrder: p.sortOrder,
        updatedAt: p.updatedAt.toISOString(),
      })),
      migrated: true,
    });
  } catch {
    // Table missing — hand back the read-only code defaults with a hint.
    const plans = await listFinuerPlans({ includeInactive: true });
    return ok({
      plans: plans.map((p, i) => ({
        id: -(i + 1),
        slug: p.id,
        label: p.label,
        tagline: p.tagline,
        priceInr: p.priceInr,
        durationDays: p.durationDays,
        features: p.features,
        unlocksPremiumBaskets: p.unlocksPremiumBaskets,
        isPurchasable: p.isPurchasable,
        isActive: true,
        badge: p.badge,
        sortOrder: p.sortOrder,
        updatedAt: null,
      })),
      migrated: false,
    });
  }
}

/** POST — create a plan. */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Only a super-admin can create plans", 403);

  const body = await parseBody<PlanBody>(req);

  const slug = String(body.slug ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return err("slug must be 2–40 chars, lowercase letters, digits or underscores");
  }
  const label = String(body.label ?? "").trim();
  if (!label) return err("label is required");

  const price = toMoney(body.priceInr) ?? 0;
  const duration = body.durationDays === null ? null : toInt(body.durationDays) ?? null;
  if (duration != null && duration < 1) return err("durationDays must be at least 1, or empty for no expiry");

  try {
    const existing = await prisma.finuerPlan.findUnique({ where: { slug } });
    if (existing) return err("A plan with that slug already exists", 409);

    const created = await prisma.finuerPlan.create({
      data: {
        slug,
        label,
        tagline: trimOrNull(body.tagline, 200) ?? null,
        priceInr: price,
        durationDays: duration,
        features: cleanFeatures(body.features) ?? [],
        unlocksPremiumBaskets: body.unlocksPremiumBaskets ?? price > 0,
        isPurchasable: body.isPurchasable ?? price > 0,
        isActive: body.isActive ?? true,
        badge: trimOrNull(body.badge, 40) ?? null,
        sortOrder: toInt(body.sortOrder) ?? 0,
        updatedByAdminId: auth.userId,
      },
    });
    invalidateFinuerPlanCache();
    return ok({ created: true, id: created.id, slug: created.slug });
  } catch {
    return err("Could not create the plan — run `npm run db:finuer-plans` first", 500);
  }
}

/** PUT — update a plan by id. Only the fields present in the body change. */
export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Only a super-admin can edit plans", 403);

  const body = await parseBody<PlanBody & { id?: number }>(req);
  const id = toInt(body.id);
  if (!id || id < 1) return err("id is required");

  const price = toMoney(body.priceInr);
  const features = cleanFeatures(body.features);
  const duration =
    body.durationDays === null ? null : body.durationDays === undefined ? undefined : toInt(body.durationDays);
  if (duration != null && duration < 1) {
    return err("durationDays must be at least 1, or empty for no expiry");
  }

  const label = body.label === undefined ? undefined : String(body.label).trim();
  if (label !== undefined && !label) return err("label cannot be empty");

  try {
    const plan = await prisma.finuerPlan.findUnique({ where: { id } });
    if (!plan) return err("Plan not found", 404);

    // The Free baseline is what every non-Pro user resolves to — deactivating or
    // making it purchasable would leave users with no plan to fall back to.
    const isFree = plan.slug === "free";

    const updated = await prisma.finuerPlan.update({
      where: { id },
      data: {
        label,
        tagline: trimOrNull(body.tagline, 200),
        ...(price !== undefined ? { priceInr: price } : {}),
        ...(duration !== undefined ? { durationDays: duration } : {}),
        ...(features !== undefined ? { features } : {}),
        ...(body.unlocksPremiumBaskets !== undefined && !isFree
          ? { unlocksPremiumBaskets: body.unlocksPremiumBaskets }
          : {}),
        ...(body.isPurchasable !== undefined && !isFree
          ? { isPurchasable: body.isPurchasable }
          : {}),
        ...(body.isActive !== undefined && !isFree ? { isActive: body.isActive } : {}),
        badge: trimOrNull(body.badge, 40),
        ...(body.sortOrder !== undefined ? { sortOrder: toInt(body.sortOrder) ?? 0 } : {}),
        updatedByAdminId: auth.userId,
      },
    });
    invalidateFinuerPlanCache();
    return ok({ updated: true, id: updated.id, slug: updated.slug, isFree });
  } catch {
    return err("Could not update the plan — run `npm run db:finuer-plans` first", 500);
  }
}

/**
 * DELETE — remove a plan. Refused while users are still on it (deactivate
 * instead, so their entitlements keep resolving until the term runs out).
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Only a super-admin can delete plans", 403);

  const id = toInt(new URL(req.url).searchParams.get("id"));
  if (!id || id < 1) return err("id is required");

  try {
    const plan = await prisma.finuerPlan.findUnique({ where: { id } });
    if (!plan) return err("Plan not found", 404);
    if (plan.slug === "free") return err("The Free baseline plan cannot be deleted");

    const inUse = await prisma.userPreference.count({
      where: { finuerProPlanId: plan.slug, finuerProExpiresAt: { gt: new Date() } },
    });
    if (inUse > 0) {
      return err(
        `${inUse} member${inUse > 1 ? "s are" : " is"} still on this plan — switch it off instead of deleting it`,
        409,
      );
    }

    await prisma.finuerPlan.delete({ where: { id } });
    invalidateFinuerPlanCache();
    return ok({ deleted: true, id });
  } catch (e) {
    if (e instanceof Error && e.message.includes("still on this plan")) throw e;
    return err("Could not delete the plan", 500);
  }
}
