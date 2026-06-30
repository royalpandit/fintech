import { NextRequest } from "next/server";
import type { SubscriptionServiceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { SERVICE_CATEGORIES, serializeService } from "@/lib/subscription-services";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set(SERVICE_CATEGORIES.map((c) => c.value));

async function getOwnedService(advisorUserId: number, id: number) {
  return prisma.advisorSubscriptionService.findFirst({
    where: { id, advisorUserId, deletedAt: null },
    include: {
      _count: {
        select: {
          subscriptions: { where: { status: "active", endDate: { gt: new Date() } } },
        },
      },
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  const service = await getOwnedService(auth.userId, id);
  if (!service) return err("Service not found", 404);

  const [subscribers, revenueAgg, trialCount] = await Promise.all([
    prisma.subscription.findMany({
      where: { serviceId: id },
      orderBy: { startDate: "desc" },
      take: 100,
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.subscription.aggregate({
      where: { serviceId: id, status: { in: ["active", "expired"] } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.subscription.count({
      where: { serviceId: id, isTrial: true, status: "active", endDate: { gt: new Date() } },
    }),
  ]);

  const monthlyRevenue = subscribers
    .filter((s) => s.status === "active" && s.planType === "monthly")
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const yearlyRevenue = subscribers
    .filter((s) => s.status === "active" && s.planType === "yearly")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const activeCount = subscribers.filter(
    (s) => s.status === "active" && s.endDate && new Date(s.endDate) > new Date(),
  ).length;
  const expiredCount = subscribers.filter((s) => s.status === "expired").length;
  const renewalRate =
    activeCount + expiredCount > 0
      ? Math.round((activeCount / (activeCount + expiredCount)) * 100)
      : 0;

  return ok({
    service: serializeService(service),
    subscribers: subscribers.map((s) => ({
      id: s.id,
      user: s.user,
      planType: s.planType,
      isTrial: s.isTrial,
      status: s.status,
      amount: Number(s.amount),
      startDate: s.startDate,
      endDate: s.endDate,
    })),
    analytics: {
      totalSubscribers: revenueAgg._count._all,
      activeSubscribers: activeCount,
      monthlyRevenue,
      yearlyRevenue,
      totalRevenue: Number(revenueAgg._sum.amount ?? 0),
      activeTrials: trialCount,
      renewalRate,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  const existing = await getOwnedService(auth.userId, id);
  if (!existing) return err("Service not found", 404);

  const body = await parseBody<{
    name?: string;
    category?: string;
    description?: string;
    monthlyPrice?: number;
    yearlyPrice?: number;
    offerFreeTrial?: boolean;
    status?: string;
    pauseNewSubscriptions?: boolean;
  }>(req);

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 3) return err("Service name must be at least 3 characters");
    data.name = name;
  }
  if (body.category !== undefined) {
    if (!VALID_CATEGORIES.has(body.category as SubscriptionServiceCategory)) {
      return err("Valid category is required");
    }
    data.category = body.category;
  }
  if (body.description !== undefined) {
    const description = body.description.trim();
    if (description.length < 20) return err("Description must be at least 20 characters");
    data.description = description;
  }
  if (body.monthlyPrice !== undefined) {
    const monthlyPrice = Number(body.monthlyPrice);
    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) return err("Valid monthly price is required");
    data.monthlyPrice = monthlyPrice;
  }
  if (body.yearlyPrice !== undefined) {
    const yearlyPrice = Number(body.yearlyPrice);
    if (!Number.isFinite(yearlyPrice) || yearlyPrice < 0) return err("Valid yearly price is required");
    data.yearlyPrice = yearlyPrice;
  }
  if (body.offerFreeTrial !== undefined) data.offerFreeTrial = Boolean(body.offerFreeTrial);
  if (body.pauseNewSubscriptions !== undefined) {
    data.pauseNewSubscriptions = Boolean(body.pauseNewSubscriptions);
  }
  if (body.status === "active" || body.status === "paused") data.status = body.status;

  const service = await prisma.advisorSubscriptionService.update({
    where: { id },
    data,
    include: {
      _count: {
        select: {
          subscriptions: { where: { status: "active", endDate: { gt: new Date() } } },
        },
      },
    },
  });

  return ok({ service: serializeService(service) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const id = Number(params.id);
  const existing = await getOwnedService(auth.userId, id);
  if (!existing) return err("Service not found", 404);

  const activeCount = await prisma.subscription.count({
    where: { serviceId: id, status: "active", endDate: { gt: new Date() } },
  });
  if (activeCount > 0) {
    return err("Cannot delete service with active subscribers. Pause it instead.", 400);
  }

  await prisma.advisorSubscriptionService.update({
    where: { id },
    data: { status: "deleted", deletedAt: new Date() },
  });

  return ok({ deleted: true });
}
