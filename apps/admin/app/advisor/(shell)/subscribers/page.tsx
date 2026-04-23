import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = { status?: string };

function formatINR(n: number | null | undefined) {
  if (!n) return "₹0";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function statusTag(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    active: { bg: "#d1fae5", color: "#047857" },
    expired: { bg: "#fee2e2", color: "#991b1b" },
    cancelled: { bg: "#e5e7eb", color: "#475569" },
    pending: { bg: "#fef3c7", color: "#92400e" },
    past_due: { bg: "#fee2e2", color: "#991b1b" },
  };
  const style = map[status] ?? map.pending;
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}

export default async function AdvisorSubscribersPage({ searchParams }: { searchParams: SearchParams }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");
  const userId = auth.userId;

  const statusFilter = searchParams.status;
  const validStatus = statusFilter && ["active", "expired", "cancelled", "pending", "past_due"].includes(statusFilter);
  const where = {
    advisorUserId: userId,
    ...(validStatus ? { status: statusFilter as any } : {}),
  };

  const [
    subscriptions,
    activeCount,
    expiredCount,
    cancelledCount,
    totalRevenue,
    avgSubscription,
  ] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, fullName: true, email: true, createdAt: true } } },
    }),
    prisma.subscription.count({ where: { advisorUserId: userId, status: "active" } }),
    prisma.subscription.count({ where: { advisorUserId: userId, status: "expired" } }),
    prisma.subscription.count({ where: { advisorUserId: userId, status: "cancelled" } }),
    prisma.subscription.aggregate({
      where: { advisorUserId: userId, status: "active" },
      _sum: { amount: true },
    }),
    prisma.subscription.aggregate({
      where: { advisorUserId: userId, status: "active" },
      _avg: { amount: true },
    }),
  ]);

  const current = statusFilter || "all";

  const tabs = [
    { key: "all", label: "All", href: "/advisor/subscribers" },
    { key: "active", label: `Active (${activeCount})`, href: "/advisor/subscribers?status=active" },
    { key: "expired", label: `Expired (${expiredCount})`, href: "/advisor/subscribers?status=expired" },
    { key: "cancelled", label: `Cancelled (${cancelledCount})`, href: "/advisor/subscribers?status=cancelled" },
  ];

  return (
    <section>
      <h1 className="page-title">Subscribers</h1>
      <p className="page-subtitle">Users paying for access to your premium advisor content.</p>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <article className="card">
          <p className="metric-label">Active Subscribers</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {activeCount.toLocaleString()}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Monthly Revenue (Active)</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {formatINR(totalRevenue._sum.amount ? Number(totalRevenue._sum.amount) : 0)}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Average Plan</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {formatINR(avgSubscription._avg.amount ? Number(avgSubscription._avg.amount) : 0)}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Churned</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {(expiredCount + cancelledCount).toLocaleString()}
          </p>
        </article>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: current === tab.key ? "#047857" : "#fff",
              color: current === tab.key ? "#fff" : "var(--text)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subscriber</th>
                <th>Email</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Started</th>
                <th>Ends</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#61708b" }}>
                    No subscribers in this bucket yet. Your subscribers will appear here once your profile goes live and users subscribe.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td style={{ fontWeight: 600 }}>{sub.user?.fullName ?? "—"}</td>
                    <td>{sub.user?.email ?? "—"}</td>
                    <td>{formatINR(Number(sub.amount))}</td>
                    <td>{statusTag(sub.status)}</td>
                    <td>{sub.startDate.toLocaleDateString()}</td>
                    <td>{sub.endDate?.toLocaleDateString() ?? "—"}</td>
                    <td style={{ textTransform: "capitalize", fontSize: 12, color: "#61708b" }}>
                      {sub.provider ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
