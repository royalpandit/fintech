import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { serializeService } from "@/lib/subscription-services";
import ManageSubscriptionService from "./manage-service";

export const dynamic = "force-dynamic";

export default async function AdvisorSubscriptionServiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const id = Number(params.id);
  const service = await prisma.advisorSubscriptionService.findFirst({
    where: { id, advisorUserId: auth.userId, deletedAt: null },
    include: {
      _count: {
        select: {
          subscriptions: { where: { status: "active", endDate: { gt: new Date() } } },
        },
      },
    },
  });
  if (!service) notFound();

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

  return (
    <ManageSubscriptionService
      initialService={serializeService(service)}
      initialSubscribers={subscribers.map((s) => ({
        id: s.id,
        user: s.user,
        planType: s.planType,
        isTrial: s.isTrial,
        status: s.status,
        amount: Number(s.amount),
        startDate: s.startDate.toISOString(),
        endDate: s.endDate?.toISOString() ?? null,
      }))}
      initialAnalytics={{
        totalSubscribers: revenueAgg._count._all,
        activeSubscribers: activeCount,
        monthlyRevenue,
        yearlyRevenue,
        totalRevenue: Number(revenueAgg._sum.amount ?? 0),
        activeTrials: trialCount,
        renewalRate:
          activeCount + expiredCount > 0
            ? Math.round((activeCount / (activeCount + expiredCount)) * 100)
            : 0,
      }}
    />
  );
}
