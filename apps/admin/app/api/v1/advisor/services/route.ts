import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { advisorServices, isServiceCategory } from "@/lib/subscription-services";
import { canType } from "@/lib/capabilities-server";

export const dynamic = "force-dynamic";

async function advisorCanMonetize(userId: number) {
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: { professionalType: true },
  });
  return canType(profile?.professionalType ?? null, "monetize.paid_subscription");
}

// Analyst subscription services (plans/bundles). Analyst-only.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);
  if (!(await advisorCanMonetize(auth.userId))) {
    return err("Paid subscriptions are not available for your professional type", 403);
  }
  return ok({ data: await advisorServices(auth.userId) });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);
  if (!(await advisorCanMonetize(auth.userId))) {
    return err("Paid subscriptions are not available for your professional type (e.g. listed companies)", 403);
  }

  const body = await parseBody<{
    name?: string;
    category?: string;
    description?: string;
    price?: number;
    yearlyPrice?: number;
    hasTrial?: boolean;
    trialDays?: number;
    isBundle?: boolean;
    memberServiceIds?: number[];
  }>(req);

  const name = (body.name ?? "").trim();
  const price = Number(body.price);
  if (!name || name.length < 2) return err("Service name is required");
  if (!Number.isFinite(price) || price < 0) return err("Enter a valid monthly price");
  const category = isServiceCategory(body.category) ? body.category : null;
  const yearlyPrice =
    typeof body.yearlyPrice === "number" && body.yearlyPrice > 0 ? body.yearlyPrice : null;
  const hasTrial = body.hasTrial === true;
  const trialDays =
    typeof body.trialDays === "number" && body.trialDays > 0 ? Math.round(body.trialDays) : 7;

  const isBundle = body.isBundle === true;
  // A bundle must reference at least two of the analyst's own services.
  let memberIds: number[] = [];
  if (isBundle) {
    const requested = Array.isArray(body.memberServiceIds)
      ? body.memberServiceIds.filter((n) => Number.isInteger(n))
      : [];
    const owned = await prisma.subscriptionService.findMany({
      where: { advisorUserId: auth.userId, id: { in: requested }, isBundle: false },
      select: { id: true },
    });
    memberIds = owned.map((s) => s.id);
    if (memberIds.length < 2) return err("A bundle needs at least two of your services");
  }

  const count = await prisma.subscriptionService.count({ where: { advisorUserId: auth.userId } });
  const service = await prisma.subscriptionService.create({
    data: {
      advisorUserId: auth.userId,
      name,
      category,
      description: body.description?.trim() || null,
      price,
      yearlyPrice,
      hasTrial,
      trialDays,
      isBundle,
      sortOrder: count,
      ...(isBundle
        ? { bundleItems: { create: memberIds.map((serviceId) => ({ serviceId })) } }
        : {}),
    },
  });

  return ok({ id: service.id });
}
