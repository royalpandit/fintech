import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { isSubscriptionActive, serializeService } from "@/lib/subscription-services";

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

  const services = await prisma.advisorSubscriptionService.findMany({
    where: {
      advisorUserId,
      deletedAt: null,
      status: { in: ["active", "paused"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          subscriptions: { where: { status: "active", endDate: { gt: new Date() } } },
        },
      },
    },
  });

  let userSubs: Map<number, { status: string; planType: string | null; endDate: Date | null }> =
    new Map();
  if (userId) {
    const subs = await prisma.subscription.findMany({
      where: { userId, serviceId: { in: services.map((s) => s.id) } },
      select: { serviceId: true, status: true, planType: true, endDate: true },
    });
    userSubs = new Map(
      subs
        .filter((s) => s.serviceId != null)
        .map((s) => [s.serviceId!, { status: s.status, planType: s.planType, endDate: s.endDate }]),
    );
  }

  return ok({
    data: services.map((s) => {
      const userSub = userSubs.get(s.id);
      return {
        ...serializeService(s),
        isSubscribed: userSub ? isSubscriptionActive(userSub) : false,
        userPlanType: userSub?.planType ?? null,
        userSubStatus: userSub?.status ?? null,
        canSubscribe: s.status === "active" && !s.pauseNewSubscriptions,
      };
    }),
  });
}
