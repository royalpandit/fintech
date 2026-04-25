import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdvisorShell from "@/components/advisor-shell";

export default async function AdvisorShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "advisor") redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [user, unreadNotifications, pendingToxicComments, wallet, todayMetric, yesterdayMetric] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        fullName: true,
        email: true,
        status: true,
        advisorProfile: {
          select: { verificationStatus: true, sebiRegistrationNo: true },
        },
      },
    }),
    prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
    prisma.marketComment.count({
      where: {
        deletedAt: null,
        post: { advisorUserId: auth.userId, deletedAt: null },
        toxicityScore: { gte: 5 },
      },
    }),
    prisma.advisorWallet.findUnique({ where: { advisorUserId: auth.userId } }),
    prisma.advisorMetricDaily.findFirst({
      where: { advisorUserId: auth.userId, day: { gte: today } },
      orderBy: { day: "desc" },
    }),
    prisma.advisorMetricDaily.findFirst({
      where: { advisorUserId: auth.userId, day: { gte: yesterday, lt: today } },
      orderBy: { day: "desc" },
    }),
  ]);

  if (!user || user.status === "suspended") redirect("/login");
  if (user.advisorProfile?.verificationStatus !== "approved") {
    redirect("/advisor/pending");
  }

  return (
    <AdvisorShell
      currentUser={{
        fullName: user.fullName,
        email: user.email,
        sebiRegistrationNo: user.advisorProfile.sebiRegistrationNo,
      }}
      badges={{
        Notifications: unreadNotifications,
        Comments: pendingToxicComments,
      }}
      walletBalance={wallet?.balance ? Number(wallet.balance) : 0}
      todayDelta={{
        current: todayMetric?.earningsAmount ? Number(todayMetric.earningsAmount) : 0,
        previous: yesterdayMetric?.earningsAmount ? Number(yesterdayMetric.earningsAmount) : 0,
      }}
    >
      {children}
    </AdvisorShell>
  );
}
