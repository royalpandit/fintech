import { NextRequest } from "next/server";
import type { SubscriptionServiceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { SERVICE_CATEGORIES, serializeService } from "@/lib/subscription-services";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set(SERVICE_CATEGORIES.map((c) => c.value));

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const services = await prisma.advisorSubscriptionService.findMany({
    where: { advisorUserId: auth.userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          subscriptions: { where: { status: "active", endDate: { gt: new Date() } } },
        },
      },
    },
  });

  return ok({ data: services.map(serializeService) });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["advisor"]);
  if (!auth) return err("Forbidden", 403);

  const body = await parseBody<{
    name?: string;
    category?: string;
    description?: string;
    monthlyPrice?: number;
    yearlyPrice?: number;
    offerFreeTrial?: boolean;
  }>(req);

  const name = (body.name ?? "").trim();
  const description = (body.description ?? "").trim();
  const category = body.category as SubscriptionServiceCategory;
  const monthlyPrice = Number(body.monthlyPrice);
  const yearlyPrice = Number(body.yearlyPrice);

  if (!name || name.length < 3) return err("Service name must be at least 3 characters");
  if (!VALID_CATEGORIES.has(category)) return err("Valid category is required");
  if (!description || description.length < 20) return err("Description must be at least 20 characters");
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) return err("Valid monthly price is required");
  if (!Number.isFinite(yearlyPrice) || yearlyPrice < 0) return err("Valid yearly price is required");

  const service = await prisma.advisorSubscriptionService.create({
    data: {
      advisorUserId: auth.userId,
      name,
      category,
      description,
      monthlyPrice,
      yearlyPrice,
      offerFreeTrial: Boolean(body.offerFreeTrial),
    },
    include: { _count: { select: { subscriptions: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: auth.userId,
      action: "subscription_service_created",
      module: "subscription_services",
      targetKind: "subscription_service",
      targetId: service.id,
    },
  });

  return ok({ service: serializeService(service) });
}
