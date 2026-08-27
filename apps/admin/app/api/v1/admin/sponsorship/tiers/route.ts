import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import {
  invalidateSponsorshipTierCache,
  listSponsorshipTiers,
} from "@/lib/sponsorship";

export const dynamic = "force-dynamic";

/**
 * Super-admin CRUD over the sponsorship tier catalog (`sponsorship_tiers`).
 * Editing a tier here changes the purchase cards on /advisor/services
 * immediately — no redeploy. Run `npm run db:sponsorship-tiers` once to create
 * the table.
 */

type TierBody = {
  slug?: string;
  label?: string;
  tagline?: string | null;
  priceInr?: number | string;
  durationDays?: number | string;
  isPurchasable?: boolean;
  isActive?: boolean;
  badge?: string | null;
  sortOrder?: number | string;
};

const SLUG_RE = /^[a-z0-9_]{2,40}$/;

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

/** GET — the whole catalog, inactive tiers included, for the editor. */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Unauthorized", 401);
  return ok({ tiers: await listSponsorshipTiers({ includeInactive: true }) });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<TierBody>(req).catch(() => null);
  if (!body) return err("Invalid body", 400);

  const slug = String(body.slug ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return err("Slug must be 2-40 characters: lowercase letters, digits, underscore", 400);
  }
  const label = String(body.label ?? "").trim();
  if (!label) return err("Label is required", 400);

  const durationDays = toInt(body.durationDays);
  if (!durationDays || durationDays < 1) return err("Duration must be at least 1 day", 400);

  const priceInr = toMoney(body.priceInr) ?? 0;

  try {
    const created = await prisma.sponsorshipTier.create({
      data: {
        slug,
        label: label.slice(0, 120),
        tagline: trimOrNull(body.tagline, 200) ?? null,
        priceInr,
        durationDays,
        isPurchasable: body.isPurchasable ?? true,
        isActive: body.isActive ?? true,
        badge: trimOrNull(body.badge, 40) ?? null,
        sortOrder: toInt(body.sortOrder) ?? 0,
        updatedByAdminId: auth.userId,
      },
      select: { slug: true },
    });
    invalidateSponsorshipTierCache();
    return ok({ slug: created.slug });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) return err("A tier with that slug already exists", 409);
    return err("Could not create tier", 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<TierBody>(req).catch(() => null);
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  if (!body || !slug) return err("Slug is required", 400);

  // Only fields actually present in the body are written, so a partial edit
  // never blanks out the rest of the row.
  const data: Record<string, unknown> = { updatedByAdminId: auth.userId };
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) return err("Label cannot be empty", 400);
    data.label = label.slice(0, 120);
  }
  if (body.tagline !== undefined) data.tagline = trimOrNull(body.tagline, 200);
  if (body.badge !== undefined) data.badge = trimOrNull(body.badge, 40);
  if (body.priceInr !== undefined) {
    const p = toMoney(body.priceInr);
    if (p === undefined) return err("Price must be a non-negative number", 400);
    data.priceInr = p;
  }
  if (body.durationDays !== undefined) {
    const d = toInt(body.durationDays);
    if (!d || d < 1) return err("Duration must be at least 1 day", 400);
    data.durationDays = d;
  }
  if (body.isPurchasable !== undefined) data.isPurchasable = Boolean(body.isPurchasable);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) data.sortOrder = toInt(body.sortOrder) ?? 0;

  try {
    await prisma.sponsorshipTier.update({ where: { slug }, data });
    invalidateSponsorshipTierCache();
    return ok({ slug });
  } catch {
    return err("Tier not found", 404);
  }
}

/**
 * DELETE — refused while advisors are mid-placement on this tier. Removing the
 * row would leave their `featured_tier` pointing at nothing, so the placement
 * they paid for would render without a label or price. Deactivate instead:
 * `isActive: false` hides it from the purchase cards while existing placements
 * keep resolving.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Unauthorized", 401);

  const slug = new URL(req.url).searchParams.get("slug")?.trim().toLowerCase();
  if (!slug) return err("Slug is required", 400);

  const inUse = await prisma.advisorProfile.count({
    where: { featuredTier: slug, featuredUntil: { gt: new Date() } },
  });
  if (inUse > 0) {
    return err(
      `${inUse} advisor${inUse === 1 ? " is" : "s are"} still featured on this tier. Deactivate it instead of deleting.`,
      409,
    );
  }

  try {
    await prisma.sponsorshipTier.delete({ where: { slug } });
    invalidateSponsorshipTierCache();
    return ok({ slug });
  } catch {
    return err("Tier not found", 404);
  }
}
