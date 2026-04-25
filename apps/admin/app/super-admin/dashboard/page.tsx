import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import Sparkline from "@/components/advisor-ui/sparkline";
import AreaChart from "@/components/advisor-ui/area-chart";
import DonutChart from "@/components/advisor-ui/donut-chart";
import TabSwitcher from "@/components/advisor-ui/tab-switcher";
import TimeRange from "@/components/advisor-ui/time-range";
import QuickCreateUser from "./quick-create-user";

export const dynamic = "force-dynamic";

type SearchParams = { range?: string; tab?: string };

function rangeToDays(range: string): number {
  switch (range) {
    case "1d":
      return 1;
    case "1w":
      return 7;
    case "3m":
      return 90;
    case "1y":
      return 365;
    case "all":
      return 3650;
    case "1m":
    default:
      return 30;
  }
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatINR(n: number, compact = false) {
  if (!n && n !== 0) return "₹0";
  if (compact && Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (compact && Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (compact && Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function relTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default async function SuperAdminDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const range = searchParams.range || "1m";
  const tab = searchParams.tab || "overview";

  const days = rangeToDays(range);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);
  const sixty = new Date();
  sixty.setDate(sixty.getDate() - 60);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [
    totalUsers,
    prevTotalUsers,
    totalAdvisors,
    prevTotalAdvisors,
    totalPosts,
    flaggedPosts,
    openReports,
    revenue30,
    revenuePrev30,
    paymentsRange,
    rolesGroup,
    topAdvisors,
    recentRegistrations,
    recentAudits,
    revenueLast14Series,
    userRegistrationsLast14,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { lt: thirty } } }),
    prisma.user.count({ where: { role: "advisor", deletedAt: null } }),
    prisma.user.count({
      where: { role: "advisor", deletedAt: null, createdAt: { lt: thirty } },
    }),
    prisma.marketPost.count({ where: { deletedAt: null } }),
    prisma.marketPost.count({
      where: { complianceStatus: "flagged", deletedAt: null },
    }),
    prisma.contentReport.count({ where: { status: "open" } }),
    prisma.payment.aggregate({
      where: { status: "success", createdAt: { gte: thirty } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "success", createdAt: { gte: sixty, lt: thirty } },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { status: "success", createdAt: { gte: fromDate } },
      orderBy: { createdAt: "asc" },
      select: { amount: true, createdAt: true },
    }),
    prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.advisorMetricDaily.groupBy({
      by: ["advisorUserId"],
      where: { day: { gte: thirty } },
      _sum: { earningsAmount: true, subscribersCount: true },
      orderBy: { _sum: { earningsAmount: "desc" } },
      take: 5,
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: {
        module: { in: ["users", "advisors", "market_posts", "payments"] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { fullName: true, role: true } } },
    }),
    prisma.payment.findMany({
      where: { status: "success", createdAt: { gte: fourteenDaysAgo } },
      orderBy: { createdAt: "asc" },
      select: { amount: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  // Bucket payments into a daily series for area chart
  const revenueByDay = new Map<string, number>();
  for (const p of paymentsRange) {
    const key = p.createdAt.toISOString().slice(0, 10);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(p.amount));
  }
  const chartData: Array<{ label: string; value: number }> = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    const key = d.toISOString().slice(0, 10);
    chartData.push({ label: dayLabel(d), value: revenueByDay.get(key) ?? 0 });
  }

  // Sparklines
  const sparkRevenue14 = (() => {
    const map = new Map<string, number>();
    for (const p of revenueLast14Series) {
      const key = p.createdAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Number(p.amount));
    }
    const out: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(map.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    return out;
  })();

  const sparkUsers14 = (() => {
    const map = new Map<string, number>();
    for (const u of userRegistrationsLast14) {
      const key = u.createdAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const out: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(map.get(d.toISOString().slice(0, 10)) ?? 0);
    }
    return out;
  })();

  const currentRevenue = Number(revenue30._sum.amount ?? 0);
  const previousRevenue = Number(revenuePrev30._sum.amount ?? 0);
  const revenueDelta =
    previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : currentRevenue > 0
        ? 100
        : 0;

  const userDelta =
    prevTotalUsers > 0
      ? ((totalUsers - prevTotalUsers) / prevTotalUsers) * 100
      : 0;
  const advisorDelta =
    prevTotalAdvisors > 0
      ? ((totalAdvisors - prevTotalAdvisors) / prevTotalAdvisors) * 100
      : 0;

  const tabs = [
    { key: "overview", label: "Overview", href: `/super-admin/dashboard?range=${range}` },
    { key: "growth", label: "Growth", href: `/super-admin/dashboard?tab=growth&range=${range}` },
    { key: "compliance", label: "Compliance", href: `/super-admin/dashboard?tab=compliance&range=${range}` },
  ];

  // User role donut
  const roleColors: Record<string, string> = {
    user: "#2563eb",
    advisor: "#10b981",
    admin: "#f59e0b",
    super_admin: "#7c3aed",
  };
  const roleLabels: Record<string, string> = {
    user: "Users",
    advisor: "Advisors",
    admin: "Admins",
    super_admin: "Super Admin",
  };
  const donutSlices = rolesGroup.map((r) => ({
    label: roleLabels[r.role] ?? r.role,
    value: r._count._all,
    color: roleColors[r.role] ?? "#94a3b8",
    detail: `${r._count._all} accounts`,
  }));
  const donutTotal = donutSlices.reduce((s, x) => s + x.value, 0);

  // Resolve top advisor names
  const topAdvisorIds = topAdvisors.map((t) => t.advisorUserId);
  const topAdvisorUsers = await prisma.user.findMany({
    where: { id: { in: topAdvisorIds } },
    select: {
      id: true,
      fullName: true,
      advisorProfile: {
        select: { sebiRegistrationNo: true },
      },
    },
  });
  const advisorById = new Map(topAdvisorUsers.map((u) => [u.id, u]));

  return (
    <section
      className="advisor-scope"
      style={{ ["--advisor-primary" as any]: "#7c3aed" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ═══ MAIN ═══ */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: -0.6,
                }}
              >
                Control Tower
              </h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                Live operational intelligence across growth, revenue, and compliance
              </p>
            </div>
            <TabSwitcher tabs={tabs} activeKey={tab} />
          </div>

          {/* KPI Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <article className="stat-card">
              <p className="stat-card-label">Total Network Users</p>
              <p className="stat-card-value">{totalUsers.toLocaleString()}</p>
              <span className={`stat-card-delta ${userDelta >= 0 ? "up" : "down"}`}>
                {userDelta >= 0 ? "↗" : "↘"} {userDelta >= 0 ? "+" : ""}
                {userDelta.toFixed(2)}%
              </span>
              <div className="stat-card-spark">
                <Sparkline values={sparkUsers14} color="#2563eb" height={36} width={300} />
              </div>
            </article>

            <article className="stat-card">
              <p className="stat-card-label">Active Advisors</p>
              <p className="stat-card-value">{totalAdvisors.toLocaleString()}</p>
              <span className={`stat-card-delta ${advisorDelta >= 0 ? "up" : "down"}`}>
                {advisorDelta >= 0 ? "↗" : "↘"} {advisorDelta >= 0 ? "+" : ""}
                {advisorDelta.toFixed(2)}%
              </span>
              <div className="stat-card-spark">
                <Sparkline values={sparkUsers14} color="#10b981" height={36} width={300} />
              </div>
            </article>

            <article className="stat-card">
              <p className="stat-card-label">Platform Revenue (30d)</p>
              <p className="stat-card-value">{formatINR(currentRevenue, true)}</p>
              <span className={`stat-card-delta ${revenueDelta >= 0 ? "up" : "down"}`}>
                {revenueDelta >= 0 ? "↗" : "↘"} {revenueDelta >= 0 ? "+" : ""}
                {revenueDelta.toFixed(2)}%
              </span>
              <div className="stat-card-spark">
                <Sparkline
                  values={sparkRevenue14}
                  color={revenueDelta >= 0 ? "#16a34a" : "#dc2626"}
                  height={36}
                  width={300}
                />
              </div>
            </article>

            <article className="stat-card">
              <p className="stat-card-label">Compliance Issues</p>
              <p
                className="stat-card-value"
                style={{ color: flaggedPosts + openReports > 0 ? "#dc2626" : "#16a34a" }}
              >
                {flaggedPosts + openReports}
              </p>
              <span
                className={`stat-card-delta ${flaggedPosts + openReports > 0 ? "down" : "up"}`}
              >
                {flaggedPosts} flagged · {openReports} reports
              </span>
              <div className="stat-card-spark">
                <Sparkline values={sparkRevenue14} color="#f59e0b" height={36} width={300} />
              </div>
            </article>
          </div>

          {/* Performance + Donut */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.55fr 1fr",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <article className="widget">
              <div className="widget-title">
                <h3>Platform Revenue</h3>
                <TimeRange baseHref="/super-admin/dashboard" activeKey={range} />
              </div>
              <AreaChart
                data={chartData}
                color="#7c3aed"
                height={260}
                valueFormatter={(n) => formatINR(n, true)}
              />
            </article>

            <article className="widget">
              <div className="widget-title">
                <h3>User Distribution</h3>
                <Link href="/super-admin/users">View all</Link>
              </div>
              {donutTotal === 0 ? (
                <div
                  style={{
                    height: 240,
                    display: "grid",
                    placeItems: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                  }}
                >
                  No users yet.
                </div>
              ) : (
                <DonutChart
                  slices={donutSlices}
                  centerLabel="Total"
                  centerValue={`${donutTotal}`}
                  size={170}
                  thickness={26}
                />
              )}
            </article>
          </div>

          {/* Top Advisors table */}
          <article className="widget">
            <div className="widget-title">
              <h3>Top Earning Advisors</h3>
              <Link href="/super-admin/advisors">View all</Link>
            </div>

            {topAdvisors.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  padding: 32,
                  color: "#94a3b8",
                  fontSize: 13,
                  margin: 0,
                }}
              >
                No advisor earnings yet in the last 30 days.
              </p>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  margin: "0 -18px -18px",
                  padding: "0 18px 6px",
                }}
              >
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#64748b" }}>
                      {["Advisor", "SEBI ID", "Subscribers", "30d Earnings", ""].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === "Advisor" || h === "SEBI ID" ? "left" : "right",
                            padding: "8px 12px 8px 0",
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                            borderBottom: "1px solid #eef0f4",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topAdvisors.map((row) => {
                      const u = advisorById.get(row.advisorUserId);
                      const earnings = Number(row._sum.earningsAmount ?? 0);
                      const subs = row._sum.subscribersCount ?? 0;
                      return (
                        <tr
                          key={row.advisorUserId}
                          style={{ borderBottom: "1px solid #f1f5f9" }}
                        >
                          <td style={{ padding: "12px 12px 12px 0" }}>
                            <Link
                              href={`/super-admin/advisors/${row.advisorUserId}`}
                              style={{
                                display: "flex",
                                gap: 10,
                                alignItems: "center",
                                color: "#0f172a",
                                textDecoration: "none",
                              }}
                            >
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  background: "rgba(124, 58, 237, 0.12)",
                                  color: "#7c3aed",
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {(u?.fullName ?? "??").slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>
                                  {u?.fullName ?? "Advisor"}
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td
                            style={{
                              padding: "12px 12px 12px 0",
                              fontFamily: "monospace",
                              fontSize: 11,
                              color: "#475569",
                            }}
                          >
                            {u?.advisorProfile?.sebiRegistrationNo ?? "—"}
                          </td>
                          <td
                            style={{ padding: "12px 12px 12px 0", textAlign: "right", fontWeight: 600 }}
                          >
                            {Number(subs).toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: "12px 12px 12px 0",
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#16a34a",
                            }}
                          >
                            {formatINR(earnings, true)}
                          </td>
                          <td style={{ padding: "12px 0", textAlign: "right" }}>
                            <Link
                              href={`/super-admin/advisors/${row.advisorUserId}`}
                              style={{
                                fontSize: 11,
                                color: "#7c3aed",
                                fontWeight: 700,
                                textDecoration: "none",
                              }}
                            >
                              View →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <aside style={{ display: "grid", gap: 14, position: "sticky", top: 16 }}>
          {/* Recent registrations watchlist */}
          <article className="widget">
            <div className="widget-title">
              <h3>New Signups (7d)</h3>
              <Link href="/super-admin/users">View all</Link>
            </div>

            {recentRegistrations.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  fontSize: 12,
                  color: "#94a3b8",
                  padding: "20px 0",
                }}
              >
                No new signups this week.
              </p>
            ) : (
              recentRegistrations.slice(0, 5).map((u) => {
                const initials = u.fullName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const roleColor = roleColors[u.role] ?? "#94a3b8";
                return (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: roleColor + "22",
                        color: roleColor,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {u.fullName}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>
                        {u.role} · {relTime(u.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </article>

          {/* Quick create user */}
          <QuickCreateUser />

          {/* Activity feed */}
          <article className="widget">
            <div className="widget-title">
              <h3>Recent Activity</h3>
              <Link href="/super-admin/audit-logs">View all</Link>
            </div>

            {recentAudits.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  fontSize: 12,
                  color: "#94a3b8",
                  padding: "20px 0",
                }}
              >
                No recent activity.
              </p>
            ) : (
              recentAudits.slice(0, 5).map((log) => {
                const action = log.action.toLowerCase();
                const tone = action.includes("approved")
                  ? "#16a34a"
                  : action.includes("flag") || action.includes("reject")
                    ? "#dc2626"
                    : "#7c3aed";
                return (
                  <div
                    key={log.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: tone,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#0f172a",
                          textTransform: "capitalize",
                        }}
                      >
                        {log.action.replace(/_/g, " ")}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {log.actor?.fullName ?? "System"} · {log.module} ·{" "}
                      {relTime(log.createdAt)}
                    </div>
                  </div>
                );
              })
            )}
          </article>
        </aside>
      </div>
    </section>
  );
}
