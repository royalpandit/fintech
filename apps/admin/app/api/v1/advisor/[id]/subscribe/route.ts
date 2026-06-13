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
  const body = await parseBody<{ amount?: number; plan?: string }>(req);

  const advisor = await prisma.user.findFirst({
    where: { id: advisorId, role: "advisor" },
  });
  if (!advisor) return err("Advisor not found", 404);

  // A paid plan (monthly/yearly) sets an end date + amount — that's what unlocks
  // chat. Without a plan it's a free subscribe (posts only). No payment is taken.
  const plan = getSubPlan(body.plan);
  let endDate: Date | undefined;
  let amount: number | undefined;
  if (plan) {
    endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.months);
    amount = plan.price;
  }

  const subscription = await prisma.subscription.upsert({
    where: {
      userId_advisorUserId: { userId, advisorUserId: advisorId },
    },
    update: { status: "active", ...(plan ? { endDate, amount } : {}) },
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
