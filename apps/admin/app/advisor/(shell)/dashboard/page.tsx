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
import { ArrowUpRight, Bell, Plus } from "@/components/advisor-ui/icons";
import QuickPost from "./quick-post";

export const dynamic = "force-dynamic";

type SearchParams = { range?: string; tab?: string };

function formatINR(n: number, compact = false) {
  if (!n && n !== 0) return "₹0";
  if (compact && Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (compact && Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
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

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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

export default async function AdvisorDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");
  const userId = auth.userId;

  const range = searchParams.range || "1m";
  const tab = searchParams.tab || "overview";

  const days = rangeToDays(range);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);
  const sixty = new Date();
  sixty.setDate(sixty.getDate() - 60);

  const [
    user,
    postCountsByStatus,
    sentimentMix,
    totalPosts,
    activeSubscribers,
    prevActiveSubscribers,
    wallet,
    metricsRange,
    metricsLast14,
    revenueRangeAgg,
    revenuePrev30Agg,
    revenue30Agg,
    recentPosts,
    recentNotifications,
    symbolGroups,
    portfolioGrowth,
    prevPortfolioGrowth,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        advisorProfile: {
          select: { sebiRegistrationNo: true, verifiedAt: true },
        },
      },
    }),
    prisma.marketPost.groupBy({
      by: ["complianceStatus"],
      where: { advisorUserId: userId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.marketPost.groupBy({
      by: ["sentiment"],
      where: { advisorUserId: userId, deletedAt: null, complianceStatus: "approved" },
      _count: { _all: true },
    }),
    prisma.marketPost.count({ where: { advisorUserId: userId, deletedAt: null } }),
    prisma.subscription.count({ where: { advisorUserId: userId, status: "active" } }),
    prisma.subscription.count({
      where: {
        advisorUserId: userId,
        status: "active",
        createdAt: { lt: thirty },
      },
    }),
    prisma.advisorWallet.findUnique({ where: { advisorUserId: userId } }),
    prisma.advisorMetricDaily.findMany({
      where: { advisorUserId: userId, day: { gte: fromDate } },
      orderBy: { day: "asc" },
    }),
    prisma.advisorMetricDaily.findMany({
      where: { advisorUserId: userId },
      orderBy: { day: "desc" },
      take: 14,
    }),
    prisma.advisorMetricDaily.aggregate({
      where: { advisorUserId: userId, day: { gte: fromDate } },
      _sum: { earningsAmount: true },
    }),
    prisma.advisorMetricDaily.aggregate({
      where: { advisorUserId: userId, day: { gte: sixty, lt: thirty } },
      _sum: { earningsAmount: true },
    }),
    prisma.advisorMetricDaily.aggregate({
      where: { advisorUserId: userId, day: { gte: thirty } },
      _sum: { earningsAmount: true },
    }),
    prisma.marketPost.findMany({
      where: { advisorUserId: userId, deletedAt: null, complianceStatus: "approved" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        sentiment: true,
        complianceStatus: true,
        marketSymbol: true,
        targetPrice: true,
        riskLevel: true,
        createdAt: true,
        _count: { select: { reactions: true, comments: true } },
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, message: true, createdAt: true, readAt: true },
    }),
    prisma.marketPost.groupBy({
      by: ["marketSymbol", "sentiment"],
      where: {
        advisorUserId: userId,
        deletedAt: null,
        complianceStatus: "approved",
        marketSymbol: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 12,
    }),
    prisma.subscription.aggregate({
      where: { advisorUserId: userId, status: "active" },
      _sum: { amount: true },
    }),
    prisma.subscription.aggregate({
      where: { advisorUserId: userId, status: "active", createdAt: { lt: thirty } },
      _sum: { amount: true },
    }),
  ]);

  if (!user) redirect("/login");

  const statusMap = postCountsByStatus.reduce<Record<string, number>>((acc, row) => {
    acc[row.complianceStatus] = row._count._all;
    return acc;
  }, {});

  const totalApproved = statusMap["approved"] ?? 0;
  const sentimentMap = sentimentMix.reduce<Record<string, number>>((acc, row) => {
    acc[row.sentiment] = row._count._all;
    return acc;
  }, {});

  const sentimentSlices = [
    { label: "Bullish", value: sentimentMap["bullish"] ?? 0, color: "#10b981" },
    { label: "Bearish", value: sentimentMap["bearish"] ?? 0, color: "#ef4444" },
    { label: "Neutral", value: sentimentMap["neutral"] ?? 0, color: "#94a3b8" },
  ];

  const walletBalance = wallet?.balance ? Number(wallet.balance) : 0;

  const currentRevenue30 = Number(revenue30Agg._sum.earningsAmount ?? 0);
  const previousRevenue30 = Number(revenuePrev30Agg._sum.earningsAmount ?? 0);
  const revenueRangeTotal = Number(revenueRangeAgg._sum.earningsAmount ?? 0);

  const portfolioCurrent = Number(portfolioGrowth._sum.amount ?? 0);
  const portfolioPrev = Number(prevPortfolioGrowth._sum.amount ?? 0);

  const todayPnL = currentRevenue30 - previousRevenue30;
  const todayPnLPct = previousRevenue30 > 0 ? ((currentRevenue30 - previousRevenue30) / previousRevenue30) * 100 : 0;

  const buyingPower = walletBalance + currentRevenue30 * 0.8; // 80% advisor cut as estimate

  // Sparklines (last 14 days)
  const spark14 = [...metricsLast14].reverse();
  const sparkRevenue = spark14.map((m) => Number(m.earningsAmount || 0));
  const sparkSubs = spark14.map((m) => m.subscribersCount);
  const sparkAccuracy = spark14.map((m) => Number(m.accuracyPct || 0));

  // Performance chart data based on range
  const chartData = metricsRange.map((m) => ({
    label: dayLabel(m.day),
    value: Number(m.earningsAmount || 0),
  }));

  // Build watchlist from symbol groups (top 5 unique symbols by post count)
  const symbolMap = new Map<string, { symbol: string; bullish: number; bearish: number; neutral: number; total: number }>();
  for (const g of symbolGroups) {
    if (!g.marketSymbol) continue;
    const cur = symbolMap.get(g.marketSymbol) ?? {
      symbol: g.marketSymbol,
      bullish: 0,
      bearish: 0,
      neutral: 0,
      total: 0,
    };
    if (g.sentiment === "bullish") cur.bullish += g._count._all;
    if (g.sentiment === "bearish") cur.bearish += g._count._all;
    if (g.sentiment === "neutral") cur.neutral += g._count._all;
    cur.total += g._count._all;
    symbolMap.set(g.marketSymbol, cur);
  }
  const watchlistRaw = Array.from(symbolMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

  const tabs = [
    { key: "overview", label: "Overview", href: `/advisor/dashboard?range=${range}` },
    { key: "performance", label: "Performance", href: `/advisor/dashboard?tab=performance&range=${range}` },
    { key: "analytics", label: "Analytics", href: `/advisor/dashboard?tab=analytics&range=${range}` },
  ];

  return (
    <section className="advisor-scope">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ═══ MAIN COLUMN ═══ */}
        <div>
          {/* Header: title + tabs */}
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
                Advisor Dashboard
              </h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                Track your sentiment, watch markets &amp; monetize your insights virtually
              </p>
            </div>
            <TabSwitcher tabs={tabs} activeKey={tab} />
          </div>

          {/* KPI Row — 4 cards with sparklines and deltas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <article className="stat-card">
              <p className="stat-card-label">Total Portfolio Value</p>
              <p className="stat-card-value">{formatINR(portfolioCurrent, true)}</p>
              <span
                className={`stat-card-delta ${portfolioCurrent >= portfolioPrev ? "up" : "down"}`}
              >
                {portfolioCurrent >= portfolioPrev ? "↗" : "↘"}{" "}
                {portfolioPrev > 0
                  ? `${(((portfolioCurrent - portfolioPrev) / portfolioPrev) * 100).toFixed(2)}%`
                  : "new"}
              </span>
              <div className="stat-card-spark">
                <Sparkline values={sparkRevenue} color="#10b981" height={36} width={300} />
              </div>
            </article>

            <article className="stat-card">
              <p className="stat-card-label">Total Posts Published</p>
              <p className="stat-card-value">{totalApproved.toLocaleString()}</p>
              <span className="stat-card-delta up">
                ↗ {totalPosts > 0 ? `${((totalApproved / totalPosts) * 100).toFixed(0)}% approval` : "—"}
              </span>
              <div className="stat-card-spark">
                <Sparkline values={sparkAccuracy} color="#2563eb" height={36} width={300} />
              </div>
            </article>

            <article className="stat-card">
              <p className="stat-card-label">Today&apos;s P&amp;L</p>
              <p
                className="stat-card-value"
                style={{ color: todayPnL >= 0 ? "#16a34a" : "#dc2626" }}
              >
                {todayPnL >= 0 ? "+" : ""}
                {formatINR(todayPnL, true)}
              </p>
              <span className={`stat-card-delta ${todayPnL >= 0 ? "up" : "down"}`}>
                {todayPnL >= 0 ? "↗" : "↘"} {todayPnLPct >= 0 ? "+" : ""}
                {todayPnLPct.toFixed(2)}%
              </span>
              <div className="stat-card-spark">
                <Sparkline values={sparkRevenue} color={todayPnL >= 0 ? "#16a34a" : "#dc2626"} height={36} width={300} />
              </div>
            </article>

            <article className="stat-card">
              <p className="stat-card-label">Buying Power</p>
              <p className="stat-card-value">{formatINR(buyingPower, true)}</p>
              <span className="stat-card-delta up">
                ↗ Wallet + 80% projected
              </span>
              <div className="stat-card-spark">
                <Sparkline values={sparkSubs.length ? sparkSubs : [0]} color="#f59e0b" height={36} width={300} />
              </div>
            </article>
          </div>

          {/* Performance chart + Donut */}
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
                <h3>Portfolio Performance</h3>
                <TimeRange baseHref="/advisor/dashboard" activeKey={range} />
              </div>
              <AreaChart
                data={chartData}
                color="#10b981"
                height={260}
                valueFormatter={(n) => formatINR(n, true)}
              />
            </article>

            <article className="widget">
              <div className="widget-title">
                <h3>Holdings</h3>
                <Link href="/advisor/posts">View all</Link>
              </div>
              {sentimentSlices.every((s) => s.value === 0) ? (
                <div
                  style={{
                    height: 240,
                    display: "grid",
                    placeItems: "center",
                    color: "#94a3b8",
                    fontSize: 13,
                  }}
                >
                  No approved posts yet.
                </div>
              ) : (
                <DonutChart
                  slices={sentimentSlices.map((s) => ({
                    ...s,
                    detail: `${s.value} posts`,
                  }))}
                  centerLabel="Total"
                  centerValue={`${totalApproved}`}
                  size={170}
                  thickness={26}
                />
              )}
            </article>
          </div>

          {/* Top Holdings table */}
          <article className="widget">
            <div className="widget-title">
              <h3>Top Holdings</h3>
              <Link href="/advisor/posts">View all</Link>
            </div>
            {recentPosts.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  padding: 32,
                  color: "#94a3b8",
                  fontSize: 13,
                  margin: 0,
                }}
              >
                No approved posts yet.{" "}
                <Link href="/advisor/posts/new" style={{ color: "#2563eb", fontWeight: 600 }}>
                  Create your first one →
                </Link>
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
                    <tr style={{ color: "#64748b", fontWeight: 600 }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 0",
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: "1px solid #eef0f4",
                        }}
                      >
                        Post / Symbol
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: "1px solid #eef0f4",
                        }}
                      >
                        Reactions
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: "1px solid #eef0f4",
                        }}
                      >
                        Target
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: "1px solid #eef0f4",
                        }}
                      >
                        Comments
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: "1px solid #eef0f4",
                        }}
                      >
                        Sentiment
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: "1px solid #eef0f4",
                        }}
                      >
                        Risk
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 0",
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: "1px solid #eef0f4",
                        }}
                      >
                        Posted
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPosts.map((post) => {
                      const sentColor: Record<string, string> = {
                        bullish: "#16a34a",
                        bearish: "#dc2626",
                        neutral: "#64748b",
                      };
                      return (
                        <tr key={post.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 0" }}>
                            <Link
                              href={`/advisor/posts/${post.id}`}
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
                                  background: `${sentColor[post.sentiment]}1a`,
                                  color: sentColor[post.sentiment],
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {post.marketSymbol?.slice(0, 4) ?? "—"}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "#0f172a",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: 220,
                                  }}
                                >
                                  {post.marketSymbol ?? "Untagged"}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "#64748b",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: 220,
                                  }}
                                >
                                  {post.title}
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>
                            {post._count.reactions}
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", color: "#475569" }}>
                            {post.targetPrice ? formatINR(Number(post.targetPrice), true) : "—"}
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", color: "#475569" }}>
                            {post._count.comments}
                          </td>
                          <td
                            style={{
                              padding: "12px",
                              textAlign: "right",
                              color: sentColor[post.sentiment],
                              fontWeight: 700,
                              textTransform: "capitalize",
                            }}
                          >
                            {post.sentiment}
                          </td>
                          <td
                            style={{
                              padding: "12px",
                              textAlign: "right",
                              textTransform: "capitalize",
                              color:
                                post.riskLevel === "high"
                                  ? "#dc2626"
                                  : post.riskLevel === "medium"
                                    ? "#f59e0b"
                                    : "#16a34a",
                              fontWeight: 600,
                            }}
                          >
                            {post.riskLevel}
                          </td>
                          <td style={{ padding: "12px 0", textAlign: "right", color: "#94a3b8", fontSize: 11 }}>
                            {relTime(post.createdAt)}
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
          {/* Watchlist */}
          <article className="widget">
            <div className="widget-title">
              <h3>Watchlist</h3>
              <Link href="/advisor/posts">View all</Link>
            </div>

            {watchlistRaw.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  fontSize: 12,
                  color: "#94a3b8",
                  padding: "20px 0",
                }}
              >
                No symbols posted yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  fontSize: 11,
                  color: "#64748b",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  padding: "0 0 8px",
                  borderBottom: "1px solid #eef0f4",
                }}
              >
                <span>Stock</span>
                <span style={{ textAlign: "right", paddingRight: 12 }}>Posts</span>
                <span style={{ textAlign: "right" }}>Bias</span>
              </div>
            )}

            {watchlistRaw.map((row) => {
              const dominant =
                row.bullish > row.bearish && row.bullish > row.neutral
                  ? "bullish"
                  : row.bearish > row.neutral
                    ? "bearish"
                    : "neutral";
              const dominantColor =
                dominant === "bullish" ? "#16a34a" : dominant === "bearish" ? "#dc2626" : "#64748b";
              const sign = dominant === "bullish" ? "+" : dominant === "bearish" ? "−" : "·";
              const symbolColor: Record<string, string> = {
                AAPL: "#0f172a",
                RELIANCE: "#0ea5e9",
                TCS: "#7c3aed",
                INFY: "#10b981",
                HDFCBANK: "#dc2626",
              };
              const initial = row.symbol.slice(0, 1);

              return (
                <div
                  key={row.symbol}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: (symbolColor[row.symbol] ?? "#475569") + "22",
                        color: symbolColor[row.symbol] ?? "#475569",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </div>
                    <div style={{ minWidth: 0 }}>
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
                        {row.symbol}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#94a3b8",
                          textTransform: "capitalize",
                        }}
                      >
                        {dominant}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      textAlign: "right",
                      paddingRight: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    {row.total}
                  </span>
                  <span
                    style={{
                      textAlign: "right",
                      fontSize: 11,
                      fontWeight: 700,
                      color: dominantColor,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 2,
                    }}
                  >
                    {sign}
                    {row.bullish > row.bearish ? row.bullish : row.bearish || row.neutral}
                  </span>
                </div>
              );
            })}
          </article>

          {/* Quick Post panel (Virtual Trade equivalent) */}
          <QuickPost />

          {/* Market News (Activity) */}
          <article className="widget">
            <div className="widget-title">
              <h3>Activity</h3>
              <Link href="/advisor/notifications">View all</Link>
            </div>

            {recentNotifications.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  fontSize: 12,
                  color: "#94a3b8",
                  padding: "20px 0",
                }}
              >
                No activity yet.
              </p>
            ) : (
              recentNotifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#0f172a",
                      marginBottom: 2,
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    {!n.readAt && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: "#2563eb",
                        }}
                      />
                    )}
                    {n.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      lineHeight: 1.5,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {n.message}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                    {relTime(n.createdAt)}
                  </div>
                </div>
              ))
            )}
          </article>
        </aside>
      </div>
    </section>
  );
}
