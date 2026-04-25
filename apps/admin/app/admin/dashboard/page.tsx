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
import QuickAction from "./quick-action";

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

export default async function AdminDashboardPage({
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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [
    pendingAdvisors,
    pendingPosts,
    flaggedPosts,
    rejectedPosts,
    approvedPosts,
    openReports,
    resolvedReports,
    pendingAdvisorsList,
    flaggedPostsList,
    auditsRange,
    auditLast7,
    auditPrev7,
    recentAudits,
    sentimentMix,
  ] = await Promise.all([
    prisma.advisorProfile.count({ where: { verificationStatus: "pending" } }),
    prisma.marketPost.count({
      where: { complianceStatus: { in: ["pending", "under_review"] }, deletedAt: null },
    }),
    prisma.marketPost.count({
      where: { complianceStatus: "flagged", deletedAt: null },
    }),
    prisma.marketPost.count({
      where: { complianceStatus: "rejected", deletedAt: null },
    }),
    prisma.marketPost.count({
      where: { complianceStatus: "approved", deletedAt: null },
    }),
    prisma.contentReport.count({ where: { status: "open" } }),
    prisma.contentReport.count({ where: { status: "resolved" } }),
    prisma.advisorProfile.findMany({
      where: { verificationStatus: "pending" },
      orderBy: { createdAt: "asc" },
      take: 8,
      include: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.marketPost.findMany({
      where: { complianceStatus: "flagged", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        advisor: { select: { id: true, fullName: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: fromDate } },
      select: { createdAt: true, action: true, module: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.auditLog.count({
      where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    prisma.auditLog.findMany({
      where: { module: { in: ["advisors", "market_posts", "users", "reports"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { fullName: true, role: true } } },
    }),
    prisma.marketPost.groupBy({
      by: ["complianceStatus"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const totalQueue = pendingAdvisors + pendingPosts + openReports;
  const totalFlagged = flaggedPosts + rejectedPosts;

  // Aggregate audits by day for performance chart
  const auditByDay = new Map<string, number>();
  for (const a of auditsRange) {
    const key = a.createdAt.toISOString().slice(0, 10);
    auditByDay.set(key, (auditByDay.get(key) ?? 0) + 1);
  }
  const chartData: Array<{ label: string; value: number }> = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    const key = d.toISOString().slice(0, 10);
    chartData.push({ label: dayLabel(d), value: auditByDay.get(key) ?? 0 });
  }

  // Sparkline series for last 14 days of audits
  const sparkAudit = chartData.slice(-14).map((d) => d.value);

  const tabs = [
    { key: "overview", label: "Overview", href: `/admin/dashboard?range=${range}` },
    { key: "queues", label: "Queues", href: `/admin/dashboard?tab=queues&range=${range}` },
    { key: "activity", label: "Activity", href: `/admin/dashboard?tab=activity&range=${range}` },
  ];

  // Sentiment / compliance mix for donut
  const statusMap = sentimentMix.reduce<Record<string, number>>((acc, row) => {
    acc[row.complianceStatus] = row._count._all;
    return acc;
  }, {});

  const donutSlices = [
    { label: "Approved", value: statusMap["approved"] ?? 0, color: "#16a34a" },
    {
      label: "Pending",
      value: (statusMap["pending"] ?? 0) + (statusMap["under_review"] ?? 0),
      color: "#f59e0b",
    },
    { label: "Flagged", value: statusMap["flagged"] ?? 0, color: "#ef4444" },
    { label: "Rejected", value: statusMap["rejected"] ?? 0, color: "#7f1d1d" },
  ];
  const donutTotal = donutSlices.reduce((s, x) => s + x.value, 0);

  return (
    <section className="advisor-scope" style={{ ["--advisor-primary" as any]: "#2563eb" }}>
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
                Moderation Dashboard
              </h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                Review verifications, moderate market posts, and act on community reports
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
            <Link
              href="/admin/advisors"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article className="stat-card" style={{ cursor: "pointer" }}>
                <p className="stat-card-label">Pending Advisor Verifications</p>
                <p
                  className="stat-card-value"
                  style={{ color: pendingAdvisors > 0 ? "#0f172a" : "#94a3b8" }}
                >
                  {pendingAdvisors}
                </p>
                <span
                  className={`stat-card-delta ${pendingAdvisors > 0 ? "down" : "up"}`}
                >
                  {pendingAdvisors > 0 ? `↗ ${pendingAdvisors} awaiting` : "✓ all clear"}
                </span>
                <div className="stat-card-spark">
                  <Sparkline values={sparkAudit} color="#f59e0b" height={36} width={300} />
                </div>
              </article>
            </Link>

            <Link
              href="/admin/market-posts"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article className="stat-card" style={{ cursor: "pointer" }}>
                <p className="stat-card-label">Posts Awaiting Review</p>
                <p
                  className="stat-card-value"
                  style={{ color: pendingPosts > 0 ? "#0f172a" : "#94a3b8" }}
                >
                  {pendingPosts}
                </p>
                <span
                  className={`stat-card-delta ${pendingPosts > 5 ? "down" : "up"}`}
                >
                  {pendingPosts > 0 ? `↗ ${pendingPosts} pending` : "✓ caught up"}
                </span>
                <div className="stat-card-spark">
                  <Sparkline values={sparkAudit} color="#2563eb" height={36} width={300} />
                </div>
              </article>
            </Link>

            <Link
              href="/admin/market-posts?status=flagged"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article className="stat-card" style={{ cursor: "pointer" }}>
                <p className="stat-card-label">Flagged Market Posts</p>
                <p
                  className="stat-card-value"
                  style={{ color: totalFlagged > 0 ? "#dc2626" : "#94a3b8" }}
                >
                  {totalFlagged}
                </p>
                <span
                  className={`stat-card-delta ${totalFlagged > 0 ? "down" : "up"}`}
                >
                  {totalFlagged > 0 ? `↗ needs review` : "✓ no flags"}
                </span>
                <div className="stat-card-spark">
                  <Sparkline values={sparkAudit} color="#ef4444" height={36} width={300} />
                </div>
              </article>
            </Link>

            <Link href="/admin/reports" style={{ textDecoration: "none", color: "inherit" }}>
              <article className="stat-card" style={{ cursor: "pointer" }}>
                <p className="stat-card-label">Open Content Reports</p>
                <p
                  className="stat-card-value"
                  style={{ color: openReports > 0 ? "#0f172a" : "#94a3b8" }}
                >
                  {openReports}
                </p>
                <span className="stat-card-delta up">
                  ✓ {resolvedReports} resolved
                </span>
                <div className="stat-card-spark">
                  <Sparkline values={sparkAudit} color="#7c3aed" height={36} width={300} />
                </div>
              </article>
            </Link>
          </div>

          {/* Performance Chart + Donut */}
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
                <h3>Moderation Activity</h3>
                <TimeRange baseHref="/admin/dashboard" activeKey={range} />
              </div>
              <AreaChart data={chartData} color="#2563eb" height={260} />
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid #eef0f4",
                  fontSize: 12,
                }}
              >
                <span>
                  <span style={{ color: "#64748b" }}>Last 7d:</span>{" "}
                  <strong>{auditLast7}</strong>
                </span>
                <span>
                  <span style={{ color: "#64748b" }}>Prev 7d:</span>{" "}
                  <strong>{auditPrev7}</strong>
                </span>
                <span
                  style={{
                    color: auditLast7 >= auditPrev7 ? "#16a34a" : "#dc2626",
                    fontWeight: 700,
                  }}
                >
                  {auditPrev7 > 0
                    ? `${(((auditLast7 - auditPrev7) / auditPrev7) * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
            </article>

            <article className="widget">
              <div className="widget-title">
                <h3>Compliance Mix</h3>
                <Link href="/admin/market-posts">View all</Link>
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
                  No posts yet on the platform.
                </div>
              ) : (
                <DonutChart
                  slices={donutSlices.map((s) => ({ ...s, detail: `${s.value} posts` }))}
                  centerLabel="Total"
                  centerValue={`${donutTotal}`}
                  size={170}
                  thickness={26}
                />
              )}
            </article>
          </div>

          {/* Pending Verifications Table */}
          <article className="widget">
            <div className="widget-title">
              <h3>Verification Queue</h3>
              <Link href="/admin/advisors">View all</Link>
            </div>

            {pendingAdvisorsList.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  padding: 32,
                  color: "#94a3b8",
                  fontSize: 13,
                  margin: 0,
                }}
              >
                ✓ No advisors awaiting verification.
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
                      {[
                        "Advisor",
                        "SEBI ID",
                        "Experience",
                        "Submitted",
                        "Wait",
                        "Action",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === "Action" ? "right" : "left",
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
                    {pendingAdvisorsList.map((adv) => {
                      const waitMs = Date.now() - adv.createdAt.getTime();
                      const waitDays = Math.floor(waitMs / (1000 * 60 * 60 * 24));
                      const isStale = waitDays >= 2;
                      return (
                        <tr key={adv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 12px 12px 0" }}>
                            <Link
                              href={`/admin/advisors/${adv.user?.id}`}
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
                                  background: "rgba(37, 99, 235, 0.1)",
                                  color: "#2563eb",
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {(adv.user?.fullName ?? "??").slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>
                                  {adv.user?.fullName ?? "Advisor"}
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
                            {adv.sebiRegistrationNo}
                          </td>
                          <td style={{ padding: "12px 12px 12px 0" }}>
                            {adv.experienceYears ? `${adv.experienceYears}y` : "—"}
                          </td>
                          <td
                            style={{ padding: "12px 12px 12px 0", color: "#64748b", fontSize: 11 }}
                          >
                            {adv.createdAt.toLocaleDateString()}
                          </td>
                          <td style={{ padding: "12px 12px 12px 0" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontSize: 10,
                                fontWeight: 700,
                                background: isStale ? "#fee2e2" : "#fef3c7",
                                color: isStale ? "#991b1b" : "#92400e",
                              }}
                            >
                              {waitDays}d
                            </span>
                          </td>
                          <td style={{ padding: "12px 0", textAlign: "right" }}>
                            <Link
                              href={`/admin/advisors/${adv.user?.id}`}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                background: "#2563eb",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 700,
                                textDecoration: "none",
                              }}
                            >
                              Review
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
          {/* Flagged posts watchlist */}
          <article className="widget">
            <div className="widget-title">
              <h3>Flagged Watchlist</h3>
              <Link href="/admin/market-posts?status=flagged">View all</Link>
            </div>

            {flaggedPostsList.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  fontSize: 12,
                  color: "#94a3b8",
                  padding: "20px 0",
                }}
              >
                ✓ No flagged posts.
              </p>
            ) : (
              flaggedPostsList.slice(0, 5).map((p) => {
                const score = p.complianceRiskScore ? Number(p.complianceRiskScore) : 0;
                return (
                  <Link
                    key={p.id}
                    href={`/admin/market-posts/${p.id}`}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                      textDecoration: "none",
                      color: "inherit",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: "rgba(239, 68, 68, 0.12)",
                        color: "#dc2626",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      🚩
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
                        {p.title}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#64748b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.advisor?.fullName ?? "—"}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: score >= 7 ? "#dc2626" : "#f59e0b",
                      }}
                    >
                      {score.toFixed(1)}
                    </span>
                  </Link>
                );
              })
            )}
          </article>

          {/* Quick action — approve/reject pending advisor */}
          <QuickAction
            topPending={pendingAdvisorsList.slice(0, 5).map((p) => ({
              userId: p.user?.id ?? 0,
              fullName: p.user?.fullName ?? "Advisor",
              sebiId: p.sebiRegistrationNo,
              submittedAt: p.createdAt.toISOString(),
            }))}
          />

          {/* Activity feed */}
          <article className="widget">
            <div className="widget-title">
              <h3>Recent Activity</h3>
              <Link href="/admin/audit-logs">View all</Link>
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
                    : "#2563eb";
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
