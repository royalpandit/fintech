import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "../../components/admin-shell";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  if (auth.role !== "super_admin") {
    if (auth.role === "admin") redirect("/admin/dashboard");
    if (auth.role === "advisor") {
      const profile = await prisma.advisorProfile.findUnique({
        where: { userId: auth.userId },
        select: { verificationStatus: true },
      });
      redirect(profile?.verificationStatus === "approved" ? "/advisor/dashboard" : "/advisor/pending");
    }
    redirect("/user/home");
  }

  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [user, revenue30, last7, prev7] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fullName: true, email: true, role: true, status: true },
    }),
    prisma.payment.aggregate({
      where: { status: "success", createdAt: { gte: thirty } },
      _sum: { amount: true },
    }),
    prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.user.count({
      where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
  ]);

  if (!user || user.status === "suspended") redirect("/login");

  const monthlyRevenue = Number(revenue30._sum.amount ?? 0);
  const weekDeltaPct =
    prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : last7 > 0 ? 100 : 0;

  return (
    <AdminShell
      currentUser={{
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      }}
      monthlyRevenue={monthlyRevenue}
      weekDeltaPct={weekDeltaPct}
    >
      {children}
    </AdminShell>
  );
}
