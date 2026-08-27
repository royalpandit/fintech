import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import {
  getSponsorshipRevenue,
  grantSponsorship,
  listFeaturedAdvisors,
  revokeSponsorship,
} from "@/lib/sponsorship";

export const dynamic = "force-dynamic";

/**
 * Super-admin oversight of who is currently a Featured Analyst.
 *
 * Until now this had no admin surface at all: advisors self-served a free
 * placement and nobody could see or undo it. GET lists every placement plus
 * recorded revenue; POST grants or extends; DELETE revokes.
 */

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Unauthorized", 401);

  const [advisors, revenue] = await Promise.all([
    listFeaturedAdvisors({ includeLapsed: true }),
    getSponsorshipRevenue(),
  ]);

  return ok({ advisors, revenue });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Unauthorized", 401);

  const body = await parseBody<{ userId?: number | string; tier?: string; days?: number | string }>(
    req,
  ).catch(() => null);
  if (!body) return err("Invalid body", 400);

  const userId = Number(body.userId);
  if (!Number.isFinite(userId)) return err("A valid advisor userId is required", 400);
  const tierId = String(body.tier ?? "").trim();
  if (!tierId) return err("A tier is required", 400);

  // An explicit day count overrides the tier duration, for one-off arrangements.
  const days = body.days == null || body.days === "" ? null : Number(body.days);
  if (days != null && (!Number.isFinite(days) || days < 1)) {
    return err("Days must be at least 1", 400);
  }

  try {
    const result = await grantSponsorship({
      userId,
      tierId,
      source: "admin_grant",
      actorAdminId: auth.userId,
      expiresAt:
        days != null ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : undefined,
    });
    return ok({
      userId,
      tier: result.tierId,
      featuredUntil: result.featuredUntil?.toISOString() ?? null,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Could not grant placement", 400);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["super_admin"]);
  if (!auth) return err("Unauthorized", 401);

  const userId = Number(new URL(req.url).searchParams.get("userId"));
  if (!Number.isFinite(userId)) return err("A valid advisor userId is required", 400);

  const exists = await prisma.advisorProfile.count({ where: { userId } });
  if (!exists) return err("Advisor profile not found", 404);

  await revokeSponsorship(userId);
  return ok({ userId, featured: false });
}
