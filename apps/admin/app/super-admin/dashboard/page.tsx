import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  FiArrowUpRight,
  FiArrowDownRight,
  FiUsers,
  FiUserCheck,
  FiTrendingUp,
  FiShield,
  FiFlag,
  FiFileText,
  FiDollarSign,
} from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import InteractiveAreaChart from "@/components/advisor-ui/interactive-area-chart";
import DonutChart from "@/components/advisor-ui/donut-chart";
import TabSwitcher from "@/components/advisor-ui/tab-switcher";
import TimeRange from "@/components/advisor-ui/time-range";

export const dynamic = "force-dynamic";

type SearchParams = { range?: string; tab?: string };

// Brand palette — green primary, blue secondary accent.
const GREEN = "#10b981";
const GREEN_SOFT = "rgba(16, 185, 129, 0.12)";
const BLUE = "#2563eb";
const BLUE_SOFT = "rgba(37, 99, 235, 0.12)";
const AMBER = "#d97706";
const AMBER_SOFT = "rgba(217, 119, 6, 0.12)";
const RED = "#dc2626";
const RED_SOFT = "rgba(220, 38, 38, 0.12)";

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

function bucketByDay(
  rows: { createdAt: Date; amount?: number }[],
  days: number,
  mode: "sum" | "count",
): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + (mode === "sum" ? Number(r.amount ?? 0) : 1));
  }
  const out: { label: string; value: number }[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    out.push({ label: dayLabel(d), value: map.get(d.toISOString().slice(0, 10)) ?? 0 });
  }
  return out;
}

function IconChip({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span className="dash-icon-chip" style={{ background: bg, color }}>
      {children}
    </span>
  );
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

  const [
    currentUser,
    totalUsers,
    prevTotalUsers,
    totalAdvisors,
    prevTotalAdvisors,
    flaggedPosts,
    openReports,
    pendingAdvisors,
    pendingPayouts,
    revenue30,
    revenuePrev30,
    paymentsRange,
    signupsRange,
    rolesGroup,
    topAdvisors,
    recentRegistrations,
    recentAudits,
    flaggedList,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.userId }, select: { fullName: true } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { lt: thirty } } }),
    prisma.user.count({ where: { role: "advisor", deletedAt: null } }),
    prisma.user.count({ where: { role: "advisor", deletedAt: null, createdAt: { lt: thirty } } }),
    prisma.marketPost.count({ where: { complianceStatus: "flagged", deletedAt: null } }),
    prisma.contentReport.count({ where: { status: "open" } }),
    prisma.advisorProfile.count({ where: { verificationStatus: "pending" } }),
    prisma.payoutRequest.count({ where: { status: "requested" } }),
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
    prisma.user.findMany({
      where: { deletedAt: null, createdAt: { gte: fromDate } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
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
      where: { module: { in: ["users", "advisors", "market_posts", "payments"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { fullName: true, role: true } } },
    }),
    prisma.marketPost.findMany({
      where: { complianceStatus: { in: ["flagged", "under_review"] }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        marketSymbol: true,
        createdAt: true,
        advisor: { select: { id: true, fullName: true } },
      },
    }),
  ]);

  const revenueChart = bucketByDay(
    paymentsRange.map((p) => ({ createdAt: p.createdAt, amount: Number(p.amount) })),
    days,
    "sum",
  );
  const signupChart = bucketByDay(signupsRange, days, "count");

  const currentRevenue = Number(revenue30._sum.amount ?? 0);
  const previousRevenue = Number(revenuePrev30._sum.amount ?? 0);
  const revenueDelta =
    previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : currentRevenue > 0
        ? 100
        : 0;

  const userDelta = prevTotalUsers > 0 ? ((totalUsers - prevTotalUsers) / prevTotalUsers) * 100 : 0;
  const advisorDelta =
    prevTotalAdvisors > 0 ? ((totalAdvisors - prevTotalAdvisors) / prevTotalAdvisors) * 100 : 0;
  const signupsInRange = signupsRange.length;

  const firstName = (currentUser?.fullName ?? "there").split(" ")[0];

  const tabs = [
    { key: "overview", label: "Overview", href: `/super-admin/dashboard?range=${range}` },
    { key: "growth", label: "Growth", href: `/super-admin/dashboard?tab=growth&range=${range}` },
    { key: "compliance", label: "Compliance", href: `/super-admin/dashboard?tab=compliance&range=${range}` },
  ];

  const roleColors: Record<string, string> = {
    user: BLUE,
    advisor: GREEN,
    admin: AMBER,
    super_admin: "#047857",
  };
  const roleLabels: Record<string, string> = {
    user: "Investors",
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

  const topAdvisorIds = topAdvisors.map((t) => t.advisorUserId);
  const topAdvisorUsers = await prisma.user.findMany({
    where: { id: { in: topAdvisorIds } },
    select: { id: true, fullName: true, advisorProfile: { select: { sebiRegistrationNo: true } } },
  });
  const advisorById = new Map(topAdvisorUsers.map((u) => [u.id, u]));

  // "Needs attention" tiles
  const attention = [
    {
      label: "Advisor approvals",
      value: pendingAdvisors,
      href: "/super-admin/advisors",
      icon: <FiUserCheck size={18} />,
      bg: BLUE_SOFT,
      color: BLUE,
    },
    {
      label: "Flagged posts",
      value: flaggedPosts,
      href: "/super-admin/ai-compliance",
      icon: <FiFlag size={18} />,
      bg: RED_SOFT,
      color: RED,
    },
    {
      label: "Open reports",
      value: openReports,
      href: "/super-admin/reports",
      icon: <FiFileText size={18} />,
      bg: AMBER_SOFT,
      color: AMBER,
    },
    {
      label: "Pending payouts",
      value: pendingPayouts,
      href: "/super-admin/payments",
      icon: <FiDollarSign size={18} />,
      bg: GREEN_SOFT,
      color: GREEN,
    },
  ];

  return (
    <section className="advisor-scope" style={{ ["--advisor-primary" as any]: GREEN }}>
      {/* Greeting header */}
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "var(--text)", letterSpacing: -0.4 }}>
            Welcome back, {firstName} 👋
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            Here&apos;s what&apos;s happening across Finuer today.
          </p>
        </div>
        <TabSwitcher tabs={tabs} activeKey={tab} />
      </div>

      {/* KPI row — icon-chip cards, each links to its module */}
      <div className="stat-grid-4" style={{ marginBottom: 16 }}>
        <Link href="/super-admin/users" className="stat-card dash-kpi" style={kpiLink}>
          <div style={kpiInner}>
            <div>
              <p className="stat-card-label">Total Network Users</p>
              <p className="stat-card-value">{totalUsers.toLocaleString()}</p>
              <span className={`stat-card-delta ${userDelta >= 0 ? "up" : "down"}`} style={deltaStyle}>
                {userDelta >= 0 ? <FiArrowUpRight size={12} /> : <FiArrowDownRight size={12} />}
                {userDelta >= 0 ? "+" : ""}
                {userDelta.toFixed(1)}% <span style={mutedSmall}>30d</span>
              </span>
            </div>
            <IconChip bg={GREEN_SOFT} color={GREEN}>
              <FiUsers size={18} />
            </IconChip>
          </div>
        </Link>

        <Link href="/super-admin/advisors" className="stat-card dash-kpi" style={kpiLink}>
          <div style={kpiInner}>
            <div>
              <p className="stat-card-label">Active Advisors</p>
              <p className="stat-card-value">{totalAdvisors.toLocaleString()}</p>
              <span className={`stat-card-delta ${advisorDelta >= 0 ? "up" : "down"}`} style={deltaStyle}>
                {advisorDelta >= 0 ? <FiArrowUpRight size={12} /> : <FiArrowDownRight size={12} />}
                {advisorDelta >= 0 ? "+" : ""}
                {advisorDelta.toFixed(1)}% <span style={mutedSmall}>30d</span>
              </span>
            </div>
            <IconChip bg={BLUE_SOFT} color={BLUE}>
              <FiUserCheck size={18} />
            </IconChip>
          </div>
        </Link>

        <Link href="/super-admin/payments" className="stat-card dash-kpi" style={kpiLink}>
          <div style={kpiInner}>
            <div>
              <p className="stat-card-label">Platform Revenue (30d)</p>
              <p className="stat-card-value">{formatINR(currentRevenue, true)}</p>
              <span className={`stat-card-delta ${revenueDelta >= 0 ? "up" : "down"}`} style={deltaStyle}>
                {revenueDelta >= 0 ? <FiArrowUpRight size={12} /> : <FiArrowDownRight size={12} />}
                {revenueDelta >= 0 ? "+" : ""}
                {revenueDelta.toFixed(1)}% <span style={mutedSmall}>vs prev</span>
              </span>
            </div>
            <IconChip bg={GREEN_SOFT} color={GREEN}>
              <FiTrendingUp size={18} />
            </IconChip>
          </div>
        </Link>

        <Link href="/super-admin/ai-compliance" className="stat-card dash-kpi" style={kpiLink}>
          <div style={kpiInner}>
            <div>
              <p className="stat-card-label">Compliance Issues</p>
              <p
                className="stat-card-value"
                style={{ color: flaggedPosts + openReports > 0 ? RED : GREEN }}
              >
                {flaggedPosts + openReports}
              </p>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                {flaggedPosts} flagged · {openReports} reports
              </span>
            </div>
            <IconChip
              bg={flaggedPosts + openReports > 0 ? RED_SOFT : GREEN_SOFT}
              color={flaggedPosts + openReports > 0 ? RED : GREEN}
            >
              <FiShield size={18} />
            </IconChip>
          </div>
        </Link>
      </div>

      {/* Needs attention */}
      <div className="stat-grid-4" style={{ marginBottom: 18 }}>
        {attention.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="card dash-tile"
            style={{ display: "block", textDecoration: "none", color: "inherit", padding: 16 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <IconChip bg={a.bg} color={a.color}>
                {a.icon}
              </IconChip>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: a.value > 0 ? a.color : "var(--text)",
                  }}
                >
                  {a.value}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{a.label}</div>
              </div>
              <span style={{ flex: 1 }} />
              <span style={{ color: "var(--text-muted)", fontSize: 16 }}>→</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ─── Tab content ─── */}
      {tab === "growth" ? (
        <div className="split-chart" style={{ marginBottom: 18 }}>
          <article className="widget">
            <div className="widget-title">
              <h3>New Signups</h3>
              <TimeRange baseHref="/super-admin/dashboard?tab=growth" activeKey={range} />
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text)", fontSize: 18 }}>{signupsInRange}</strong> new users in
              this window
            </p>
            <InteractiveAreaChart data={signupChart} color={BLUE} height={260} format="number" />
          </article>
          <article className="widget">
            <div className="widget-title">
              <h3>Latest Signups</h3>
              <Link href="/super-admin/users">View all</Link>
            </div>
            {recentRegistrations.length === 0 ? (
              <p style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
                No new signups this week.
              </p>
            ) : (
              recentRegistrations.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: (roleColors[u.role] ?? "#94a3b8") + "22",
                      color: roleColors[u.role] ?? "#94a3b8",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {u.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{u.fullName}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {u.role} · {relTime(u.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </article>
        </div>
      ) : tab === "compliance" ? (
        <div className="split-chart" style={{ marginBottom: 18 }}>
          <article className="widget">
            <div className="widget-title">
              <h3>Posts Needing Review</h3>
              <Link href="/super-admin/ai-compliance">Open AI Compliance</Link>
            </div>
            {flaggedList.length === 0 ? (
              <p style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
                Nothing flagged. All clear. 🎉
              </p>
            ) : (
              flaggedList.map((p) => (
                <Link
                  key={p.id}
                  href={`/super-admin/market-posts/${p.id}`}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: RED,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {p.advisor?.fullName ?? "—"}
                      {p.marketSymbol ? ` · ${p.marketSymbol}` : ""} · {relTime(p.createdAt)}
                    </div>
                  </div>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                </Link>
              ))
            )}
          </article>
          <article className="widget">
            <div className="widget-title">
              <h3>Compliance Snapshot</h3>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { label: "Flagged posts", value: flaggedPosts, tone: flaggedPosts > 0 ? RED : GREEN, href: "/super-admin/ai-compliance" },
                { label: "Open reports", value: openReports, tone: openReports > 0 ? AMBER : GREEN, href: "/super-admin/reports" },
                { label: "Advisor approvals", value: pendingAdvisors, tone: pendingAdvisors > 0 ? BLUE : GREEN, href: "/super-admin/advisors" },
              ].map((row) => (
                <Link
                  key={row.label}
                  href={row.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{row.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: row.tone }}>{row.value}</span>
                </Link>
              ))}
            </div>
          </article>
        </div>
      ) : (
        <div className="split-chart" style={{ marginBottom: 18 }}>
          <article className="widget">
            <div className="widget-title">
              <h3>Platform Revenue</h3>
              <TimeRange baseHref="/super-admin/dashboard" activeKey={range} />
            </div>
            <InteractiveAreaChart data={revenueChart} color={GREEN} height={260} format="inr-compact" />
          </article>
          <article className="widget">
            <div className="widget-title">
              <h3>User Distribution</h3>
              <Link href="/super-admin/users">View all</Link>
            </div>
            {donutTotal === 0 ? (
              <div style={{ height: 240, display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
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
      )}

      {/* Bottom: top advisors + recent activity */}
      <div className="split-chart" style={{ alignItems: "start" }}>
        <article className="widget">
          <div className="widget-title">
            <h3>Top Earning Advisors</h3>
            <Link href="/super-admin/advisors">View all</Link>
          </div>
          {topAdvisors.length === 0 ? (
            <p style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
              No advisor earnings yet in the last 30 days.
            </p>
          ) : (
            <div style={{ overflowX: "auto", margin: "0 -18px -18px", padding: "0 18px 6px" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
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
                          borderBottom: "1px solid var(--border)",
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
                      <tr key={row.advisorUserId} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 12px 12px 0" }}>
                          <Link
                            href={`/super-admin/advisors/${row.advisorUserId}`}
                            style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--text)", textDecoration: "none" }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: GREEN_SOFT,
                                color: "#047857",
                                display: "grid",
                                placeItems: "center",
                                fontSize: 11,
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              {(u?.fullName ?? "??").slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{u?.fullName ?? "Advisor"}</div>
                          </Link>
                        </td>
                        <td style={{ padding: "12px 12px 12px 0", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
                          {u?.advisorProfile?.sebiRegistrationNo ?? "—"}
                        </td>
                        <td style={{ padding: "12px 12px 12px 0", textAlign: "right", fontWeight: 600 }}>
                          {Number(subs).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px 12px 12px 0", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>
                          {formatINR(earnings, true)}
                        </td>
                        <td style={{ padding: "12px 0", textAlign: "right" }}>
                          <Link
                            href={`/super-admin/advisors/${row.advisorUserId}`}
                            style={{ fontSize: 11, color: "#047857", fontWeight: 700, textDecoration: "none" }}
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

        <article className="widget">
          <div className="widget-title">
            <h3>Recent Activity</h3>
            <Link href="/super-admin/audit-logs">View all</Link>
          </div>
          {recentAudits.length === 0 ? (
            <p style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
              No recent activity.
            </p>
          ) : (
            recentAudits.slice(0, 6).map((log) => {
              const action = log.action.toLowerCase();
              const tone = action.includes("approved")
                ? GREEN
                : action.includes("flag") || action.includes("reject")
                  ? RED
                  : BLUE;
              return (
                <div key={log.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>
                      {log.action.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {log.actor?.fullName ?? "System"} · {log.module} · {relTime(log.createdAt)}
                  </div>
                </div>
              );
            })
          )}
        </article>
      </div>
    </section>
  );
}

const kpiLink: React.CSSProperties = { display: "block", textDecoration: "none", color: "inherit" };
const kpiInner: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
};
const deltaStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4 };
const mutedSmall: React.CSSProperties = { color: "var(--text-muted)", fontWeight: 500 };
