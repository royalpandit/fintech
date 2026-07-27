import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import ManageServiceClient from "./manage-client";

export const dynamic = "force-dynamic";

export default async function ManageServicePage({ params }: { params: { id: string } }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "advisor") redirect("/login");

  const id = Number(params.id);
  const service = await prisma.subscriptionService.findFirst({
    where: { id, advisorUserId: auth.userId },
  });
  if (!service) notFound();

  const subs = await prisma.serviceSubscription.findMany({
    where: { serviceId: id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { fullName: true } } },
  });

  const now = new Date();
  const activeSubs = subs.filter(
    (s) => s.status === "active" && (!s.endDate || new Date(s.endDate) > now),
  );
  const activeTrials = activeSubs.filter((s) => s.isTrial).length;
  const monthly = Number(service.price);
  // No billing engine — revenue is a snapshot: active subscribers × price.
  const monthlyRevenue = activeSubs.length * monthly;
  const yearlyRevenue =
    service.yearlyPrice != null ? activeSubs.length * Number(service.yearlyPrice) : monthlyRevenue * 12;

  return (
    <ManageServiceClient
      service={{
        id: service.id,
        name: service.name,
        category: service.category,
        description: service.description,
        price: monthly,
        yearlyPrice: service.yearlyPrice != null ? Number(service.yearlyPrice) : null,
        hasTrial: service.hasTrial,
        trialDays: service.trialDays,
        paused: service.paused,
      }}
      subscribers={subs.map((s) => ({
        name: s.user.fullName,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate ? s.endDate.toISOString() : null,
        isTrial: s.isTrial,
        status:
          s.status !== "active"
            ? "Cancelled"
            : s.endDate && new Date(s.endDate) <= now
              ? "Expired"
              : "Active",
      }))}
      analytics={{
        total: subs.length,
        active: activeSubs.length,
        activeTrials,
        monthlyRevenue,
        yearlyRevenue,
      }}
    />
  );
}
