import { NextRequest } from "next/server";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  getSponsorshipStatus,
  grantSponsorship,
  listPurchasableSponsorshipTiers,
  revokeSponsorship,
} from "@/lib/sponsorship";

export const dynamic = "force-dynamic";

/**
 * Paid "Featured Analyst" promotion, advisor self-serve.
 *
 * Tiers now come from `sponsorship_tiers` (editable in super-admin) rather than
 * a hardcoded map, and every purchase writes a `payments` row so the revenue is
 * actually recorded. The card is still not charged — see the PAYMENT SEAM note
 * in lib/sponsorship.ts.
 */

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth || auth.role !== "advisor") return err("Unauthorized", 401);

  const [status, tiers] = await Promise.all([
    getSponsorshipStatus(auth.userId),
    listPurchasableSponsorshipTiers(),
  ]);

  return ok({
    featured: status.featured,
    featuredUntil: status.featuredUntil,
    tier: status.tierId,
    daysLeft: status.daysLeft,
    tiers,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth || auth.role !== "advisor") return err("Unauthorized", 401);

  const body = await parseBody<{ tier?: string }>(req).catch(() => ({}) as { tier?: string });

  // Fall back to the cheapest purchasable tier rather than a hardcoded
  // "monthly", which may have been renamed or switched off in super-admin.
  const tiers = await listPurchasableSponsorshipTiers();
  if (tiers.length === 0) return err("No sponsorship tiers are available", 409);
  const chosen = tiers.find((t) => t.id === body?.tier) ?? tiers[0];

  try {
    await grantSponsorship({
      userId: auth.userId,
      tierId: chosen.id,
      source: "purchase",
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not apply placement", 400);
  }

  const status = await getSponsorshipStatus(auth.userId);
  return ok({
    featured: status.featured,
    featuredUntil: status.featuredUntil,
    tier: status.tierId,
    daysLeft: status.daysLeft,
    tiers,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth || auth.role !== "advisor") return err("Unauthorized", 401);
  await revokeSponsorship(auth.userId);
  const tiers = await listPurchasableSponsorshipTiers();
  return ok({ featured: false, featuredUntil: null, tier: null, daysLeft: 0, tiers });
}
