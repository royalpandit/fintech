import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UserShell from "@/components/user-shell";
import AdvisorApprovalWatcher from "@/components/advisor-approval-watcher";

// Guests can browse user-facing pages without an account.
// Auth-only roles (advisor, admin, super_admin) get punted to their own consoles.
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);

  // True when a not-yet-approved advisor is browsing the community while they
  // wait. We mount a watcher that auto-sends them to their console on approval.
  let pendingAdvisor = false;

  if (auth) {
    if (auth.role === "super_admin") redirect("/super-admin/dashboard");
    if (auth.role === "admin") redirect("/admin/dashboard");
    if (auth.role === "advisor") {
      const profile = await prisma.advisorProfile.findUnique({
        where: { userId: auth.userId },
        select: { verificationStatus: true },
      });
      // Approved advisors have their own console — send them there.
      // Pending/rejected advisors have no console yet, so let them browse the
      // user-facing community while they wait (the pending page links here).
      if (profile?.verificationStatus === "approved") {
        redirect("/advisor/dashboard");
      }
      pendingAdvisor = true;
    }
  }

  let user: { fullName: string; email: string; isVerified: boolean } | null = null;
  let unreadNotifications = 0;
  let walletBalance = 0;
  let todayPnL = 0;
  let todayPnLPct = 0;

  if (auth) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [u, unread, wallet, todayPortfolio, yesterdayPortfolio] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { fullName: true, email: true, status: true, emailVerifiedAt: true },
      }),
      prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
      prisma.virtualWallet.findUnique({ where: { userId: auth.userId } }),
      prisma.portfolioSnapshotDaily.findFirst({
        where: { portfolio: { userId: auth.userId }, day: { gte: today } },
        orderBy: { day: "desc" },
      }),
      prisma.portfolioSnapshotDaily.findFirst({
        where: {
          portfolio: { userId: auth.userId },
          day: { gte: yesterday, lt: today },
        },
        orderBy: { day: "desc" },
      }),
    ]);

    if (u && u.status !== "suspended") {
      user = { fullName: u.fullName, email: u.email, isVerified: Boolean(u.emailVerifiedAt) };
      unreadNotifications = unread;
      walletBalance = wallet?.balance ? Number(wallet.balance) : 0;

      const todayValue = todayPortfolio?.totalValue ? Number(todayPortfolio.totalValue) : 0;
      const yesterdayValue = yesterdayPortfolio?.totalValue
        ? Number(yesterdayPortfolio.totalValue)
        : 0;
      todayPnL = todayValue - yesterdayValue;
      todayPnLPct =
        yesterdayValue > 0 ? ((todayValue - yesterdayValue) / yesterdayValue) * 100 : 0;
    }
  }

  return (
    <UserShell
      currentUser={user}
      unreadNotifications={unreadNotifications}
      walletBalance={walletBalance}
      todayPnL={todayPnL}
      todayPnLPct={todayPnLPct}
    >
      {pendingAdvisor && <AdvisorApprovalWatcher />}
      {children}
    </UserShell>
  );
}
