import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { isSubscriptionActive, categoryLabel } from "@/lib/subscription-services";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const advisorUserId = Number(params.id);
  if (!Number.isInteger(advisorUserId)) return err("Invalid advisor id", 400);

  const advisor = await prisma.user.findFirst({
    where: { id: advisorUserId, role: "advisor", deletedAt: null },
    select: { id: true },
  });
  if (!advisor) return err("Advisor not found", 404);

  const token = req.cookies.get("access_token")?.value ?? null;
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const { requireAuthToken } = await import("@/lib/auth");
  const auth = await requireAuthToken(bearer ?? token);
  const userId = auth?.userId ?? null;

  const services = await prisma.subscriptionService.findMany({
    where: {
      advisorUserId,
      isActive: true,
      paused: false,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          subscriptions: { where: { status: "active", OR: [{ endDate: null }, { endDate: { gt: new Date() } }] } },
        },
      },
    },
  });

  let userSubIds = new Set<number>();
  if (userId) {
    const subs = await prisma.serviceSubscription.findMany({
      where: {
        userId,
        advisorUserId,
        status: "active",
        OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
      },
      select: { serviceId: true },
    });
    userSubIds = new Set(subs.map((s) => s.serviceId));
  }

  return ok({
    data: services.map((s) => ({
      id: s.id,
      advisorUserId: s.advisorUserId,
      name: s.name,
      category: s.category,
      categoryLabel: s.category ? categoryLabel(s.category) : null,
      description: s.description,
      price: Number(s.price),
      yearlyPrice: s.yearlyPrice != null ? Number(s.yearlyPrice) : null,
      hasTrial: s.hasTrial,
      trialDays: s.trialDays,
      isBundle: s.isBundle,
      paused: s.paused,
      subscriberCount: s._count.subscriptions,
      isSubscribed: userSubIds.has(s.id),
    })),
  });
}
