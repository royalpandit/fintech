import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Paid "Featured Analyst" promotion. Payment is BYPASSED for now (no gateway) —
// POST just extends featuredUntil; DELETE removes it. Flag when billing goes live.
const TIER_DAYS: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90 };

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth || auth.role !== "advisor") return err("Unauthorized", 401);
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: auth.userId },
    select: { featuredUntil: true, featuredTier: true },
  });
  const active = Boolean(profile?.featuredUntil && profile.featuredUntil.getTime() > Date.now());
  return ok({ featured: active, featuredUntil: profile?.featuredUntil ?? null, tier: profile?.featuredTier ?? null });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth || auth.role !== "advisor") return err("Unauthorized", 401);

  const body = await parseBody<{ tier?: string }>(req).catch(() => ({}) as { tier?: string });
  const tier = body?.tier && body.tier in TIER_DAYS ? body.tier : "monthly";
  const days = TIER_DAYS[tier];

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: auth.userId },
    select: { featuredUntil: true },
  });
  if (!profile) return err("Advisor profile not found", 404);

  const base =
    profile.featuredUntil && profile.featuredUntil.getTime() > Date.now()
      ? new Date(profile.featuredUntil)
      : new Date();
  base.setDate(base.getDate() + days);

  const updated = await prisma.advisorProfile.update({
    where: { userId: auth.userId },
    data: { featuredUntil: base, featuredTier: tier },
    select: { featuredUntil: true, featuredTier: true },
  });
  return ok({ featured: true, featuredUntil: updated.featuredUntil, tier: updated.featuredTier });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth || auth.role !== "advisor") return err("Unauthorized", 401);
  await prisma.advisorProfile.update({
    where: { userId: auth.userId },
    data: { featuredUntil: null, featuredTier: null },
  });
  return ok({ featured: false });
}
