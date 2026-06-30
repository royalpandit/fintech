import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import {
  planEndDate,
  planPrice,
  type ServicePlanType,
} from "@/lib/subscription-services";
import { creditAdvisorEarnings } from "@/lib/subscription-services-server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const serviceId = Number(params.id);
  const body = await parseBody<{ plan?: string }>(req);
  const plan = body.plan as ServicePlanType;

  if (plan !== "monthly" && plan !== "yearly") {
    return err("Plan must be monthly or yearly", 400);
  }

  const service = await prisma.advisorSubscriptionService.findFirst({
    where: {
      id: serviceId,
      deletedAt: null,
      status: "active",
    },
  });
  if (!service) return err("Service not found", 404);
  if (service.pauseNewSubscriptions) return err("This service is not accepting new subscribers", 403);
  if (service.advisorUserId === auth.userId) return err("You cannot subscribe to your own service", 400);

  const priorSub = await prisma.subscription.findUnique({
    where: { userId_serviceId: { userId: auth.userId, serviceId } },
  });

  let useTrial = false;
  if (service.offerFreeTrial && !priorSub) {
    useTrial = true;
  }

  const effectivePlan: ServicePlanType = useTrial ? "trial" : plan;
  const amount = useTrial ? 0 : planPrice(service, plan);
  const endDate = planEndDate(effectivePlan);
  const startDate = new Date();

  const subscription = await prisma.subscription.upsert({
    where: { userId_serviceId: { userId: auth.userId, serviceId } },
    update: {
      status: "active",
      planType: useTrial ? "trial" : plan,
      isTrial: useTrial,
      amount,
      startDate,
      endDate,
    },
    create: {
      userId: auth.userId,
      advisorUserId: service.advisorUserId,
      serviceId,
      planType: useTrial ? "trial" : plan,
      isTrial: useTrial,
      amount,
      status: "active",
      startDate,
      endDate,
    },
  });

  if (amount > 0) {
    await prisma.payment.create({
      data: {
        userId: auth.userId,
        kind: "subscription",
        amount,
        status: "success",
        provider: "dev_bypass",
        referenceKind: "subscription",
        referenceId: subscription.id,
        metadata: { serviceId, plan, advisorUserId: service.advisorUserId },
      },
    });
    await creditAdvisorEarnings(service.advisorUserId, amount);
  }

  return ok({
    subscription_status: subscription.status,
    plan: useTrial ? "trial" : plan,
    service_id: serviceId,
    end_date: endDate,
    amount,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const serviceId = Number(params.id);
  const existing = await prisma.subscription.findUnique({
    where: { userId_serviceId: { userId: auth.userId, serviceId } },
    select: { id: true },
  });
  if (!existing) return ok({ subscription_status: "cancelled" });

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { status: "cancelled" },
  });

  return ok({ subscription_status: "cancelled" });
}
