import { prisma } from "@/lib/prisma";
import AreaChart from "@/components/advisor-ui/area-chart";
import DonutChart from "@/components/advisor-ui/donut-chart";
import Sparkline from "@/components/advisor-ui/sparkline";
import TimeRange from "@/components/advisor-ui/time-range";

export const dynamic = "force-dynamic";

type SearchParams = { range?: string };

function rangeToDays(range: string): number {
  switch (range) {
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

const ROLE_COLORS: Record<string, string> = {
  user: "#2563eb",
  advisor: "#10b981",
  admin: "#f59e0b",
  super_admin: "#7c3aed",
};
const ROLE_LABELS: Record<string, string> = {
  user: "Users",
  advisor: "Advisors",
  admin: "Admins",
  super_admin: "Super Admin",
};

export default async function SuperAdminAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const range = searchParams.range ?? "1m";
  const days = rangeToDays(range);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);
  const sixty = new Date();
  sixty.setDate(sixty.getDate() - 60);

  const [
    totalUsers,
    totalAdvisors,
    activeSubs,
    rolesGroup,
    paymentsRange,
    paymentsPrev30,
    paymentsCurr30,
    providers,
    registrationsRange,
    sentimentMix,
    complianceMix,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: "advisor", deletedAt: null } }),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.payment.findMany({
      where: { status: "success", createdAt: { gte: fromDate } },
      orderBy: { createdAt: "asc" },
      select: { amount: true, createdAt: true, kind: true },
    }),
    prisma.payment.aggregate({
      where: { status: "success", createdAt: { gte: sixty, lt: thirty } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "success", createdAt: { gte: thirty } },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["provider"],
      where: { status: "success", createdAt: { gte: thirty } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: fromDate } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, role: true },
    }),
    prisma.marketPost.groupBy({
      by: ["sentiment"],
      where: { deletedAt: null, complianceStatus: "approved" },
      _count: { _all: true },
    }),
    prisma.marketPost.groupBy({
      by: ["complianceStatus"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  // Bucket payments by day
  const revenueByDay = new Map<string, number>();
  for (const p of paymentsRange) {
    const k = p.createdAt.toISOString().slice(0, 10);
    revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + Number(p.amount));
  }

  // Bucket registrations by day
  const usersByDay = new Map<string, number>();
  for (const u of registrationsRange) {
    const k = u.createdAt.toISOString().slice(0, 10);
    usersByDay.set(k, (usersByDay.get(k) ?? 0) + 1);
  }

  const revenueChart: Array<{ label: string; value: number }> = [];
  const usersChart: Array<{ label: string; value: number }> = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    const k = d.toISOString().slice(0, 10);
    const lbl = dayLabel(d);
    revenueChart.push({ label: lbl, value: revenueByDay.get(k) ?? 0 });
    usersChart.push({ label: lbl, value: usersByDay.get(k) ?? 0 });
  }

  const totalRevenue = paymentsRange.reduce((s, p) => s + Number(p.amount), 0);
  const currRevenue30 = Number(paymentsCurr30._sum.amount ?? 0);
  const prevRevenue30 = Number(paymentsPrev30._sum.amount ?? 0);
  const revenueDelta =
    prevRevenue30 > 0 ? ((currRevenue30 - prevRevenue30) / prevRevenue30) * 100 : 0;

  const userDistribution = rolesGroup.map((r) => ({
    label: ROLE_LABELS[r.role] ?? r.role,
    value: r._count._all,
    color: ROLE_COLORS[r.role] ?? "#94a3b8",
    detail: `${r._count._all} accounts`,
  }));

  const sentimentSlices = [
    {
      label: "Bullish",
      value: sentimentMix.find((s) => s.sentiment === "bullish")?._count._all ?? 0,
      color: "#16a34a",
    },
    {
      label: "Bearish",
      value: sentimentMix.find((s) => s.sentiment === "bearish")?._count._all ?? 0,
      color: "#dc2626",
    },
    {
      label: "Neutral",
      value: sentimentMix.find((s) => s.sentiment === "neutral")?._count._all ?? 0,
      color: "#94a3b8",
    },
  ];
  const sentimentTotal = sentimentSlices.reduce((s, x) => s + x.value, 0);

  const userTotal = userDistribution.reduce((s, x) => s + x.value, 0);

  // Compliance mix: simple bar chart values
  const complianceSlices = [
    {
      label: "Approved",
      value: complianceMix.find((c) => c.complianceStatus === "approved")?._count._all ?? 0,
      color: "#16a34a",
    },
    {
      label: "Pending",
      value:
        (complianceMix.find((c) => c.complianceStatus === "pending")?._count._all ?? 0) +
        (complianceMix.find((c) => c.complianceStatus === "under_review")?._count._all ?? 0),
      color: "#f59e0b",
    },
    {
      label: "Flagged",
      value: complianceMix.find((c) => c.complianceStatus === "flagged")?._count._all ?? 0,
      color: "#ef4444",
    },
    {
      label: "Rejected",
      value: complianceMix.find((c) => c.complianceStatus === "rejected")?._count._all ?? 0,
      color: "#7f1d1d",
    },
  ];
  const complianceTotal = complianceSlices.reduce((s, x) => s + x.value, 0);

  return (
    <section className="advisor-scope" style={{ ["--advisor-primary" as any]: "#7c3aed" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
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
            Platform Analytics
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Strategic insights across users, revenue, and compliance
          </p>
        </div>
        <TimeRange baseHref="/super-admin/analytics" activeKey={range} />
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <article className="stat-card">
          <p className="stat-card-label">Total Users</p>
          <p className="stat-card-value">{totalUsers.toLocaleString()}</p>
          <span className="stat-card-delta up">↗ Active network</span>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Active Advisors</p>
          <p className="stat-card-value" style={{ color: "#10b981" }}>
            {totalAdvisors.toLocaleString()}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Active Subscriptions</p>
          <p className="stat-card-value">{activeSubs.toLocaleString()}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Revenue (30d)</p>
          <p className="stat-card-value">{formatINR(currRevenue30, true)}</p>
          <span className={`stat-card-delta ${revenueDelta >= 0 ? "up" : "down"}`}>
            {revenueDelta >= 0 ? "↗" : "↘"} {revenueDelta >= 0 ? "+" : ""}
            {revenueDelta.toFixed(2)}%
          </span>
        </article>
      </div>

      {/* Revenue + User distribution */}
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
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
              Total {formatINR(totalRevenue, true)}
            </span>
          </div>
          <AreaChart
            data={revenueChart}
            color="#7c3aed"
            height={240}
            valueFormatter={(n) => formatINR(n, true)}
          />
        </article>

        <article className="widget">
          <div className="widget-title">
            <h3>User Distribution</h3>
          </div>
          {userTotal === 0 ? (
            <div
              style={{
                height: 220,
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
              slices={userDistribution}
              centerLabel="Total"
              centerValue={`${userTotal}`}
              size={170}
              thickness={26}
            />
          )}
        </article>
      </div>

      {/* User growth chart + Sentiment donut */}
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
            <h3>User Registrations</h3>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
              {registrationsRange.length} new in window
            </span>
          </div>
          <AreaChart data={usersChart} color="#2563eb" height={240} />
        </article>

        <article className="widget">
          <div className="widget-title">
            <h3>Sentiment Mix</h3>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
              Approved posts
            </span>
          </div>
          {sentimentTotal === 0 ? (
            <div
              style={{
                height: 220,
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
              slices={sentimentSlices.map((s) => ({ ...s, detail: `${s.value} posts` }))}
              centerLabel="Total"
              centerValue={`${sentimentTotal}`}
              size={170}
              thickness={26}
            />
          )}
        </article>
      </div>

      {/* Compliance mix bar + Payment providers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <article className="widget">
          <div className="widget-title">
            <h3>Compliance Mix</h3>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
              {complianceTotal} posts
            </span>
          </div>
          <div className="segmented-bar" style={{ marginTop: 8, height: 12 }}>
            {complianceSlices.map((s, i) => {
              const pct = complianceTotal > 0 ? (s.value / complianceTotal) * 100 : 0;
              return (
                <div
                  key={i}
                  className="segmented-bar-fill"
                  style={{ width: `${pct}%`, background: s.color }}
                />
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {complianceSlices.map((s) => {
              const pct = complianceTotal > 0 ? (s.value / complianceTotal) * 100 : 0;
              return (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: s.color,
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>
                      {s.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{pct.toFixed(0)}%</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#0f172a",
                        minWidth: 30,
                        textAlign: "right",
                      }}
                    >
                      {s.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="widget">
          <div className="widget-title">
            <h3>Payment Providers (30d)</h3>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
              {providers.length} providers
            </span>
          </div>
          {providers.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              No successful payments in the last 30 days.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {providers
                .sort(
                  (a, b) =>
                    Number(b._sum.amount ?? 0) - Number(a._sum.amount ?? 0),
                )
                .map((p) => {
                  const amt = Number(p._sum.amount ?? 0);
                  const totalAmt = providers.reduce(
                    (s, x) => s + Number(x._sum.amount ?? 0),
                    0,
                  );
                  const pct = totalAmt > 0 ? (amt / totalAmt) * 100 : 0;
                  return (
                    <div key={p.provider ?? "unknown"}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                          {p.provider ?? "Direct"}
                        </span>
                        <span style={{ fontWeight: 700 }}>{formatINR(amt, true)}</span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: "#eef0f4",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: "#7c3aed",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                        {p._count._all} transactions · {pct.toFixed(0)}% of revenue
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
