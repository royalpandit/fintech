import { prisma } from "@/lib/prisma";
import {
  ADVISOR_REVENUE_SHARE,
  isSubscriptionActive,
} from "@/lib/subscription-services";

/** User has any active paid/trial sub to this advisor (legacy or per-service). */
export async function hasActiveAdvisorAccess(
  userId: number,
  advisorUserId: number,
): Promise<boolean> {
  const legacy = await prisma.subscription.findUnique({
    where: { userId_advisorUserId: { userId, advisorUserId } },
    select: { status: true, endDate: true },
  });
  if (isSubscriptionActive(legacy)) return true;

  const serviceSub = await prisma.subscription.findFirst({
    where: {
      userId,
      advisorUserId,
      serviceId: { not: null },
      status: "active",
      endDate: { gt: new Date() },
    },
    select: { id: true },
  });
  return Boolean(serviceSub);
}

export async function creditAdvisorEarnings(
  advisorUserId: number,
  grossAmount: number,
): Promise<void> {
  const share = Math.round(grossAmount * ADVISOR_REVENUE_SHARE * 100) / 100;
  if (share <= 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.$transaction([
    prisma.advisorWallet.upsert({
      where: { advisorUserId },
      create: { advisorUserId, balance: share },
      update: { balance: { increment: share } },
    }),
    prisma.advisorMetricDaily.upsert({
      where: { advisorUserId_day: { advisorUserId, day: today } },
      create: {
        advisorUserId,
        day: today,
        earningsAmount: share,
        subscribersCount: 1,
      },
      update: {
        earningsAmount: { increment: share },
        subscribersCount: { increment: 1 },
      },
    }),
  ]);
}
