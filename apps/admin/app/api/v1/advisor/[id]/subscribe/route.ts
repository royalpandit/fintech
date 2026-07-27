import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";
import { getSubPlan } from "@/lib/subscription-plans";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const userId = auth.userId;

  const advisorId = Number(params.id);
  const body = await parseBody<{ amount?: number; plan?: string; serviceId?: number; billing?: string }>(req);

  const advisor = await prisma.user.findFirst({
    where: { id: advisorId, role: "advisor" },
  });
  if (!advisor) return err("Advisor not found", 404);

  // Optional: subscribe to a specific analyst service. Recorded in
  // service_subscriptions; the flat subscription below still grants chat access.
  let service: { id: number; price: number } | null = null;
  if (body.serviceId != null) {
    const svc = await prisma.subscriptionService.findFirst({
      where: { id: Number(body.serviceId), advisorUserId: advisorId, isActive: true },
      select: { id: true, price: true, yearlyPrice: true, hasTrial: true, trialDays: true, paused: true },
    });
    if (!svc) return err("Service not found", 404);
    if (svc.paused) return err("This service is not accepting new subscribers right now", 403);

    // Determine period + trial. Yearly billing when asked and priced; else monthly.
    const yearly = body.billing === "yearly" && svc.yearlyPrice != null;
    const chargePrice = yearly ? Number(svc.yearlyPrice) : Number(svc.price);
    service = { id: svc.id, price: chargePrice };

    // First-time trial → active but flagged, expires after trialDays.
    const existing = await prisma.serviceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: svc.id } },
      select: { id: true, isTrial: true },
    });
    const grantTrial = svc.hasTrial && !existing;
    const endDate = new Date();
    if (grantTrial) endDate.setDate(endDate.getDate() + svc.trialDays);
    else if (yearly) endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);

    await prisma.serviceSubscription.upsert({
      where: { userId_serviceId: { userId, serviceId: svc.id } },
      update: { status: "active", isTrial: grantTrial, endDate },
      create: { userId, advisorUserId: advisorId, serviceId: svc.id, status: "active", isTrial: grantTrial, endDate },
    });
  }

  // A paid plan (monthly/yearly) sets an end date + amount — that's what unlocks
  // chat. Without a plan it's a free subscribe (posts only). No payment is taken.
  const plan = getSubPlan(body.plan);
  let endDate: Date | undefined;
  let amount: number | undefined;
  if (plan) {
    endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.months);
    amount = plan.price;
  } else if (service) {
    // Owning a service grants chat access — activate the flat subscription for a
    // month at the service price.
    endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    amount = service.price;
  }

  const subscription = await prisma.subscription.upsert({
    where: {
      userId_advisorUserId: { userId, advisorUserId: advisorId },
    },
    update: { status: "active", ...(plan || service ? { endDate, amount } : {}) },
    create: {
      userId,
      advisorUserId: advisorId,
      amount: amount ?? body.amount ?? 0,
      status: "active",
      ...(endDate ? { endDate } : {}),
    },
  });

  return ok({
    advisor_id: advisorId,
    subscription_status: subscription.status,
    plan: plan?.id ?? null,
    service_id: service?.id ?? null,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const advisorId = Number(params.id);
  if (!Number.isInteger(advisorId)) return err("Invalid advisor id");

  const existing = await prisma.subscription.findUnique({
    where: { userId_advisorUserId: { userId: auth.userId, advisorUserId: advisorId } },
    select: { id: true },
  });
  if (!existing) return ok({ advisor_id: advisorId, subscription_status: "cancelled" });

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { status: "cancelled" },
  });

  return ok({ advisor_id: advisorId, subscription_status: "cancelled" });
}
