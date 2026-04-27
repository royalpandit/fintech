import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import AreaChart from "@/components/advisor-ui/area-chart";
import DonutChart from "@/components/advisor-ui/donut-chart";
import TabSwitcher from "@/components/advisor-ui/tab-switcher";
import TimeRange from "@/components/advisor-ui/time-range";
import { CheckCircle } from "@/components/advisor-ui/icons";

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
  if (compact && Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (compact && Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const SYMBOL_COLORS: Record<string, string> = {
  AAPL: "#0f172a",
  RELIANCE: "#0ea5e9",
  TCS: "#7c3aed",
  INFY: "#10b981",
  HDFCBANK: "#dc2626",
  ICICIBANK: "#f59e0b",
};

export default async function UserDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  const range = searchParams.range || "1m";
  const tab = searchParams.tab || "overview";
  const days = rangeToDays(range);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const [
    portfolios,
    wallet,
    snapshots,
    holdings,
    virtualHoldings,
    topAdvisorMetrics,
    topSymbols,
    sentimentMix,
    featuredCourses,
    totalAdvisors,
    totalApprovedPosts,
  ] = await Promise.all([
    userId
      ? prisma.portfolio.findMany({
          where: { userId, deletedAt: null },
          orderBy: { totalValue: "desc" },
        })
      : Promise.resolve([]),
    userId
      ? prisma.virtualWallet.findUnique({ where: { userId } })
      : Promise.resolve(null),
    userId
      ? prisma.portfolioSnapshotDaily.findMany({
          where: {
            portfolio: { userId },
            day: { gte: fromDate },
          },
          orderBy: { day: "asc" },
        })
      : Promise.resolve([]),
    userId
      ? prisma.portfolioAsset.findMany({
          where: { portfolio: { userId, deletedAt: null } },
          orderBy: { quantity: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
    userId
      ? prisma.tradeVirtual.findMany({
          where: { wallet: { userId } },
          orderBy: { tradedAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    prisma.advisorMetricDaily.groupBy({
      by: ["advisorUserId"],
      where: { day: { gte: new Date(Date.now() - 30 * 86400_000) } },
      _sum: { subscribersCount: true, accuracyPct: true },
      orderBy: { _sum: { subscribersCount: "desc" } },
      take: 5,
    }),
    prisma.marketPost.groupBy({
      by: ["marketSymbol"],
      where: {
        complianceStatus: "approved",
        deletedAt: null,
        marketSymbol: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.marketPost.groupBy({
      by: ["sentiment"],
      where: { complianceStatus: "approved", deletedAt: null },
      _count: { _all: true },
    }),
    prisma.course.findMany({
      where: { deletedAt: null, isPublished: true, complianceStatus: "approved" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        advisor: { select: { fullName: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.user.count({ where: { role: "advisor", deletedAt: null } }),
    prisma.marketPost.count({
      where: { complianceStatus: "approved", deletedAt: null },
    }),
  ]);

  // Hydrate top advisors
  const advisorIds = topAdvisorMetrics.map((m) => m.advisorUserId);
  const advisorUsers = advisorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: advisorIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const advisorById = new Map(advisorUsers.map((u) => [u.id, u]));

  // ════ Compute KPIs ════
  const activePortfolio = portfolios[0];
  const totalValue = activePortfolio ? Number(activePortfolio.totalValue) : 0;
  const totalInvested = holdings.reduce(
    (s, h) => s + Number(h.averagePrice) * Number(h.quantity),
    0,
  );
  const currentHoldingsValue = holdings.reduce(
    (s, h) => s + Number(h.currentPrice ?? h.averagePrice) * Number(h.quantity),
    0,
  );

  // Today's P&L from latest two snapshots
  const sortedSnaps = [...snapshots].sort(
    (a, b) => a.day.getTime() - b.day.getTime(),
  );
  const todayValue =
    sortedSnaps.length > 0
      ? Number(sortedSnaps[sortedSnaps.length - 1].totalValue)
      : totalValue;
  const yesterdayValue =
    sortedSnaps.length > 1
      ? Number(sortedSnaps[sortedSnaps.length - 2].totalValue)
      : totalInvested;
  const todayPnL = todayValue - yesterdayValue;
  const todayPnLPct =
    yesterdayValue > 0 ? ((todayValue - yesterdayValue) / yesterdayValue) * 100 : 0;

  const buyingPower = wallet?.balance ? Number(wallet.balance) : 0;

  // Performance chart from snapshots
  const chartData =
    sortedSnaps.length > 0
      ? sortedSnaps.map((s) => ({
          label: dayLabel(s.day),
          value: Number(s.totalValue),
        }))
      : // Demo curve for guests / users without data — synthetic but visually useful
        Array.from({ length: days > 30 ? 30 : days }, (_, i) => {
          const base = 100000;
          const trend = i * 850;
          const noise = Math.sin(i * 0.6) * 1500;
          const d = new Date();
          d.setDate(d.getDate() - (days > 30 ? 30 - i : days - i));
          return { label: dayLabel(d), value: base + trend + noise };
        });

  // Holdings donut
  const donutHoldings =
    holdings.length > 0
      ? holdings.slice(0, 5).map((h) => ({
          label: h.symbol,
          value: Number(h.currentPrice ?? h.averagePrice) * Number(h.quantity),
          color: SYMBOL_COLORS[h.symbol] ?? "#64748b",
          detail: formatINR(
            Number(h.currentPrice ?? h.averagePrice) * Number(h.quantity),
            true,
          ),
        }))
      : topSymbols.slice(0, 5).map((s) => ({
          label: s.marketSymbol ?? "—",
          value: s._count._all,
          color: SYMBOL_COLORS[s.marketSymbol ?? ""] ?? "#64748b",
          detail: `${s._count._all} posts`,
        }));
  const donutTotal = donutHoldings.reduce((s, x) => s + x.value, 0);

  // Watchlist data — derive from top symbols + sentiment for guests
  const watchlistRows =
    topSymbols.length > 0
      ? topSymbols.map((s) => {
          // Use post count as a proxy for "price" + a delta in [-2, +2]%
          const symbol = s.marketSymbol ?? "—";
          const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1 % symbol.length);
          const price = 1000 + (seed % 3000);
          const change = ((seed % 100) - 50) / 25; // -2 to +2
          return {
            symbol,
            company:
              symbol === "AAPL"
                ? "Apple Inc."
                : symbol === "RELIANCE"
                  ? "Reliance Ind."
                  : symbol === "TCS"
                    ? "Tata Cons. Svcs."
                    : symbol === "INFY"
                      ? "Infosys Ltd."
                      : symbol === "HDFCBANK"
                        ? "HDFC Bank"
                        : symbol,
            price,
            change,
          };
        })
      : [
          { symbol: "AAPL", company: "Apple Inc.", price: 169.3, change: 1.23 },
          { symbol: "RELIANCE", company: "Reliance Ind.", price: 2280, change: 0.98 },
          { symbol: "TCS", company: "Tata Cons. Svcs.", price: 3465, change: 1.45 },
          { symbol: "INFY", company: "Infosys Ltd.", price: 1525, change: -0.35 },
          { symbol: "HDFCBANK", company: "HDFC Bank", price: 1640, change: 0.65 },
        ];

  const tabs = [
    { key: "overview", label: "Overview", href: `/user/home?range=${range}` },
    { key: "performance", label: "Performance", href: `/user/home?tab=performance&range=${range}` },
    { key: "analytics", label: "Analytics", href: `/user/home?tab=analytics&range=${range}` },
  ];

  const positiveDelta = todayPnLPct >= 0;

  return (
    <section>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* ═══ MAIN ═══ */}
        <div>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: -0.5,
                }}
              >
                Trading Dashboard
              </h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
                Track your portfolio, watch markets &amp; trade virtually
              </p>
            </div>
            <TabSwitcher tabs={tabs} activeKey={tab} />
          </div>

          {/* KPI cards row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <article
              style={{
                background: "#fff",
                border: "1px solid #eef0f4",
                borderRadius: 14,
                padding: 16,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "#64748b",
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                Total Portfolio Value
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: -0.6,
                  }}
                >
                  {formatINR(totalValue || 125430.5)}
                </p>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: positiveDelta ? "#16a34a" : "#dc2626",
                  }}
                >
                  {positiveDelta ? "+" : ""}
                  {todayPnLPct.toFixed(2)}%
                </span>
              </div>
              <svg
                viewBox="0 0 280 28"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  width: "100%",
                  height: 28,
                  pointerEvents: "none",
                }}
              >
                <defs>
                  <linearGradient id="kpi1-grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 22 L 30 18 L 60 20 L 90 14 L 120 16 L 150 10 L 180 12 L 210 6 L 240 8 L 280 4 L 280 28 L 0 28 Z"
                  fill="url(#kpi1-grad)"
                />
                <path
                  d="M 0 22 L 30 18 L 60 20 L 90 14 L 120 16 L 150 10 L 180 12 L 210 6 L 240 8 L 280 4"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="1.6"
                />
              </svg>
            </article>

            <article
              style={{
                background: "#fff",
                border: "1px solid #eef0f4",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "#64748b",
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                Total Invested
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: -0.6,
                }}
              >
                {formatINR(totalInvested || 98750)}
              </p>
            </article>

            <article
              style={{
                background: "#fff",
                border: "1px solid #eef0f4",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "#64748b",
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                Today&apos;s P&amp;L
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: positiveDelta ? "#16a34a" : "#dc2626",
                  letterSpacing: -0.6,
                }}
              >
                {positiveDelta ? "+" : "−"}
                {formatINR(Math.abs(todayPnL || 2450.75))}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  color: positiveDelta ? "#16a34a" : "#dc2626",
                  fontWeight: 600,
                }}
              >
                ({positiveDelta ? "+" : ""}
                {todayPnLPct.toFixed(2)}%)
              </p>
            </article>

            <article
              style={{
                background: "#fff",
                border: "1px solid #eef0f4",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "#64748b",
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                Buying Power
                <span style={{ marginLeft: 4, color: "#94a3b8" }}>ⓘ</span>
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: -0.6,
                }}
              >
                {formatINR(buyingPower || 26680.5)}
              </p>
            </article>
          </div>

          {/* Performance + Holdings */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.55fr 1fr",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <article
              style={{
                background: "#fff",
                border: "1px solid #eef0f4",
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  Portfolio Performance
                </h3>
                <TimeRange baseHref="/user/home" activeKey={range} />
              </div>
              <AreaChart
                data={chartData}
                color="#16a34a"
                height={240}
                valueFormatter={(n) => formatINR(n, true)}
              />
            </article>

            <article
              style={{
                background: "#fff",
                border: "1px solid #eef0f4",
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  Holdings
                </h3>
                <Link
                  href="/user/portfolio"
                  style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 600 }}
                >
                  View all
                </Link>
              </div>
              {donutTotal === 0 ? (
                <div
                  style={{
                    height: 220,
                    display: "grid",
                    placeItems: "center",
                    color: "#94a3b8",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  No holdings yet.
                  <br />
                  Connect a portfolio or use the lab.
                </div>
              ) : (
                <DonutChart
                  slices={donutHoldings}
                  centerLabel="Total"
                  centerValue={formatINR(totalValue || 125430.5, true)}
                  size={170}
                  thickness={26}
                />
              )}
            </article>
          </div>

          {/* Top Holdings table */}
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #eef0f4" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                Top Holdings
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      { label: "Stock", align: "left" },
                      { label: "Shares", align: "right" },
                      { label: "Avg. Price", align: "right" },
                      { label: "Current Price", align: "right" },
                      { label: "Value", align: "right" },
                      { label: "P&L", align: "right" },
                      { label: "P&L %", align: "right" },
                    ].map((h) => (
                      <th
                        key={h.label}
                        style={{
                          textAlign: h.align as any,
                          padding: "10px 18px",
                          fontWeight: 600,
                          fontSize: 10,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: 0.6,
                          borderBottom: "1px solid #eef0f4",
                        }}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(holdings.length > 0
                    ? holdings.map((h) => {
                        const cp = Number(h.currentPrice ?? h.averagePrice);
                        const ap = Number(h.averagePrice);
                        const qty = Number(h.quantity);
                        const value = cp * qty;
                        const pnl = (cp - ap) * qty;
                        const pnlPct = ap > 0 ? ((cp - ap) / ap) * 100 : 0;
                        return {
                          symbol: h.symbol,
                          company: h.symbol,
                          shares: qty,
                          avg: ap,
                          curr: cp,
                          value,
                          pnl,
                          pnlPct,
                        };
                      })
                    : [
                        // Fallback rows so the screen is never empty
                        {
                          symbol: "AAPL",
                          company: "Apple Inc.",
                          shares: 50,
                          avg: 150,
                          curr: 169.3,
                          value: 8465,
                          pnl: 965,
                          pnlPct: 12.87,
                        },
                        {
                          symbol: "RELIANCE",
                          company: "Reliance Ind.",
                          shares: 100,
                          avg: 2105,
                          curr: 2280,
                          value: 228000,
                          pnl: 17500,
                          pnlPct: 8.31,
                        },
                        {
                          symbol: "TCS",
                          company: "Tata Cons. Svcs.",
                          shares: 75,
                          avg: 3250,
                          curr: 3465,
                          value: 259875,
                          pnl: 16125,
                          pnlPct: 6.62,
                        },
                        {
                          symbol: "HDFCBANK",
                          company: "HDFC Bank",
                          shares: 80,
                          avg: 1450,
                          curr: 1640,
                          value: 131200,
                          pnl: 15200,
                          pnlPct: 13.1,
                        },
                      ]
                  ).map((row) => {
                    const positive = row.pnl >= 0;
                    const color = SYMBOL_COLORS[row.symbol] ?? "#64748b";
                    return (
                      <tr key={row.symbol} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 18px" }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                background: color + "1a",
                                color,
                                display: "grid",
                                placeItems: "center",
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              {row.symbol.slice(0, 1)}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                                {row.symbol}
                              </div>
                              <div style={{ fontSize: 10, color: "#64748b" }}>{row.company}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right" }}>
                          {row.shares}
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right" }}>
                          {formatINR(row.avg)}
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right" }}>
                          {formatINR(row.curr)}
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right", fontWeight: 600 }}>
                          {formatINR(row.value, true)}
                        </td>
                        <td
                          style={{
                            padding: "12px 18px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: positive ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {positive ? "+" : "−"}
                          {formatINR(Math.abs(row.pnl))}
                        </td>
                        <td
                          style={{
                            padding: "12px 18px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: positive ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {positive ? "+" : ""}
                          {row.pnlPct.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        {/* ═══ RIGHT RAIL ═══ */}
        <aside style={{ display: "grid", gap: 14, position: "sticky", top: 80 }}>
          {/* Watchlist */}
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                Watchlist
              </h3>
              <Link
                href="/user/watchlist"
                style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 600 }}
              >
                View all
              </Link>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 60px",
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                paddingBottom: 8,
                borderBottom: "1px solid #eef0f4",
              }}
            >
              <span>Stock</span>
              <span style={{ textAlign: "right" }}>Price</span>
              <span style={{ textAlign: "right" }}>Change</span>
            </div>

            {watchlistRows.map((row) => {
              const positive = row.change >= 0;
              const color = SYMBOL_COLORS[row.symbol] ?? "#64748b";
              return (
                <div
                  key={row.symbol}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 60px",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: color + "1a",
                        color,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {row.symbol.slice(0, 1)}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>
                        {row.symbol}
                      </div>
                      <div style={{ fontSize: 9, color: "#64748b" }}>{row.company}</div>
                    </div>
                  </div>
                  <span
                    style={{
                      textAlign: "right",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    ₹{row.price.toFixed(2)}
                  </span>
                  <span
                    style={{
                      textAlign: "right",
                      fontSize: 11,
                      fontWeight: 700,
                      color: positive ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {positive ? "+" : ""}
                    {row.change.toFixed(2)}%{" "}
                    {positive ? "↗" : "↘"}
                  </span>
                </div>
              );
            })}
          </article>

          {/* Virtual Trade */}
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                Virtual Trade
              </h3>
              <Link href="/user/lab" style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 600 }}>
                View all
              </Link>
            </div>

            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                display: "block",
                marginBottom: 4,
              }}
            >
              Select Stock
            </label>
            <input
              placeholder="Search or select stock"
              style={{
                width: "100%",
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid #eef0f4",
                background: "#fff",
                fontSize: 12,
                outline: "none",
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />

            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                display: "block",
                marginBottom: 4,
              }}
            >
              Order Type
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 4,
                background: "#f8fafc",
                borderRadius: 8,
                padding: 3,
                marginBottom: 10,
              }}
            >
              <button
                type="button"
                style={{
                  padding: 8,
                  borderRadius: 6,
                  border: "none",
                  background: "#16a34a",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Buy
              </button>
              <button
                type="button"
                style={{
                  padding: 8,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Sell
              </button>
            </div>

            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                display: "block",
                marginBottom: 4,
              }}
            >
              Quantity
            </label>
            <input
              placeholder="Enter quantity"
              type="number"
              style={{
                width: "100%",
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid #eef0f4",
                background: "#fff",
                fontSize: 12,
                outline: "none",
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />

            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                display: "block",
                marginBottom: 4,
              }}
            >
              Price Type
            </label>
            <select
              style={{
                width: "100%",
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid #eef0f4",
                background: "#fff",
                fontSize: 12,
                outline: "none",
                marginBottom: 14,
                boxSizing: "border-box",
              }}
            >
              <option>Market Price</option>
              <option>Limit Order</option>
            </select>

            <AuthGate
              isAuthenticated={isAuthed}
              promptTitle="Sign in to trade virtually"
              promptDescription="Open the Virtual Lab with ₹10L of practice capital. Sign up free."
            >
              <button
                type="button"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  background: "#16a34a",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Place Virtual Order
              </button>
            </AuthGate>
          </article>

          {/* Market News */}
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                Market News
              </h3>
              <Link href="/user/markets" style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 600 }}>
                View all
              </Link>
            </div>

            {[
              {
                title: "Markets rally as tech stocks lead the gain",
                source: "Market Watch",
                time: "2h ago",
              },
              {
                title: "RBI keeps rates unchanged, maintains growth forecast",
                source: "Economic Times",
                time: "4h ago",
              },
              {
                title: `${totalAdvisors.toLocaleString()} SEBI advisors now active on Corescent`,
                source: "Platform News",
                time: "6h ago",
              },
              {
                title: `${totalApprovedPosts.toLocaleString()} verified sentiment posts published`,
                source: "Platform News",
                time: "8h ago",
              },
            ].map((news, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#0f172a",
                    lineHeight: 1.4,
                    marginBottom: 4,
                  }}
                >
                  {news.title}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>
                  {news.time} · {news.source}
                </p>
              </div>
            ))}
          </article>

          {!isAuthed && (
            <article
              style={{
                background: "linear-gradient(135deg, #f0fdf4, #ecfeff)",
                border: "1px solid #bbf7d0",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <CheckCircle size={18} style={{ color: "#16a34a" }} />
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>You&apos;re browsing as guest</h3>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                Sign up to track real portfolio, follow advisors, trade in the lab, and unlock
                personalized insights.
              </p>
              <Link
                href="/register"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0ea5e9, #16a34a)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                Get started — free
              </Link>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}
