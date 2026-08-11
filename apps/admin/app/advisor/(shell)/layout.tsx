import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdvisorShell from "@/components/advisor-shell";
import { canType } from "@/lib/capabilities-server";

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
          select: {
            verificationStatus: true,
            sebiRegistrationNo: true,
            verificationFormSubmittedAt: true,
            profileImageUrl: true,
            professionalType: true,
          },
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

  const caps = {
    paidSubs: await canType(user.advisorProfile?.professionalType ?? null, "monetize.paid_subscription"),
    courses: await canType(user.advisorProfile?.professionalType ?? null, "course.sell"),
    reports: await canType(user.advisorProfile?.professionalType ?? null, "report.sell"),
  };
  const hiddenModules = [
    ...(!caps.paidSubs ? ["Subscription Services"] : []),
    ...(!caps.courses ? ["Courses"] : []),
    ...(!caps.reports ? ["Reports"] : []),
  ];

  return (
    <AdvisorShell
      currentUser={{
        fullName: user.fullName,
        email: user.email,
        sebiRegistrationNo: user.advisorProfile.sebiRegistrationNo,
        profileImageUrl: user.advisorProfile.profileImageUrl,
      }}
      badges={{
        Notifications: unreadNotifications,
        Comments: pendingToxicComments,
      }}
      needsVerification={!user.advisorProfile.verificationFormSubmittedAt}
      walletBalance={wallet?.balance ? Number(wallet.balance) : 0}
      todayDelta={{
        current: todayMetric?.earningsAmount ? Number(todayMetric.earningsAmount) : 0,
        previous: yesterdayMetric?.earningsAmount ? Number(yesterdayMetric.earningsAmount) : 0,
      }}
      hiddenModules={hiddenModules}
    >
      {children}
    </AdvisorShell>
  );
}
