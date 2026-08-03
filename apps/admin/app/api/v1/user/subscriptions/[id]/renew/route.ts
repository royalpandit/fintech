import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// `kind=advisor` targets the legacy advisor-level Subscription; otherwise the
// per-service ServiceSubscription. Payment is BYPASSED for now (no gateway) —
// renew just extends the end date. Flag when billing goes live.

function extend(current: Date | null | undefined, yearly: boolean): Date {
  const base =
    current && new Date(current).getTime() > Date.now() ? new Date(current) : new Date();
  if (yearly) base.setFullYear(base.getFullYear() + 1);
  else base.setMonth(base.getMonth() + 1);
  return base;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const id = Number(params.id);
  if (!Number.isInteger(id)) return err("Invalid subscription");

  const kind = new URL(req.url).searchParams.get("kind") === "advisor" ? "advisor" : "service";
  const body = await parseBody<{ billing?: string }>(req).catch(() => ({}) as { billing?: string });
  const yearly = body?.billing === "yearly";

  if (kind === "advisor") {
    const sub = await prisma.subscription.findUnique({
      where: { id },
      select: { id: true, userId: true, endDate: true },
    });
    if (!sub || sub.userId !== auth.userId) return err("Subscription not found", 404);
    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: "active", endDate: extend(sub.endDate, yearly) },
      select: { id: true, endDate: true, status: true },
    });
    return ok({ subscription: updated });
  }

  const sub = await prisma.serviceSubscription.findUnique({
    where: { id },
    select: { id: true, userId: true, endDate: true },
  });
  if (!sub || sub.userId !== auth.userId) return err("Subscription not found", 404);
  const updated = await prisma.serviceSubscription.update({
    where: { id },
    data: { status: "active", isTrial: false, endDate: extend(sub.endDate, yearly) },
    select: { id: true, endDate: true, status: true },
  });
  return ok({ subscription: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const id = Number(params.id);
  if (!Number.isInteger(id)) return err("Invalid subscription");

  const kind = new URL(req.url).searchParams.get("kind") === "advisor" ? "advisor" : "service";

  if (kind === "advisor") {
    const sub = await prisma.subscription.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!sub || sub.userId !== auth.userId) return err("Subscription not found", 404);
    await prisma.subscription.update({ where: { id }, data: { status: "cancelled" } });
    return ok({ cancelled: true });
  }
  const sub = await prisma.serviceSubscription.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!sub || sub.userId !== auth.userId) return err("Subscription not found", 404);
  await prisma.serviceSubscription.update({ where: { id }, data: { status: "cancelled" } });
  return ok({ cancelled: true });
}
