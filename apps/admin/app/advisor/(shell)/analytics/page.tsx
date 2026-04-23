import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdvisorAnalyticsPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");
  const userId = auth.userId;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [
    metrics,
    postSentimentCounts,
    postAssetCounts,
    engagementTotals,
    topPosts,
    recentSubs,
  ] = await Promise.all([
    prisma.advisorMetricDaily.findMany({
      where: { advisorUserId: userId, day: { gte: ninetyDaysAgo } },
      orderBy: { day: "asc" },
    }),
    prisma.marketPost.groupBy({
      by: ["sentiment"],
      where: { advisorUserId: userId, deletedAt: null, complianceStatus: "approved" },
      _count: { _all: true },
    }),
    prisma.marketPost.groupBy({
      by: ["assetType"],
      where: { advisorUserId: userId, deletedAt: null, complianceStatus: "approved" },
      _count: { _all: true },
    }),
    prisma.marketPost.findMany({
      where: { advisorUserId: userId, deletedAt: null },
      select: { _count: { select: { reactions: true, comments: true } } },
    }),
    prisma.marketPost.findMany({
      where: { advisorUserId: userId, deletedAt: null, complianceStatus: "approved" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        marketSymbol: true,
        sentiment: true,
        createdAt: true,
        _count: { select: { reactions: true, comments: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { advisorUserId: userId, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true, status: true },
    }),
  ]);

  const totalReactions = engagementTotals.reduce((s, p) => s + p._count.reactions, 0);
  const totalComments = engagementTotals.reduce((s, p) => s + p._count.comments, 0);

  // Accuracy series for chart (daily)
  const maxAccuracy = 100;
  const accuracySeries = metrics.map((m) => Number(m.accuracyPct || 0));
  const roiSeries = metrics.map((m) => Number(m.roiPct || 0));

  const latestAccuracy = accuracySeries.length ? accuracySeries[accuracySeries.length - 1] : 0;
  const latestROI = roiSeries.length ? roiSeries[roiSeries.length - 1] : 0;

  // Top posts by engagement
  const ranked = [...topPosts]
    .map((p) => ({
      ...p,
      engagement: p._count.reactions + p._count.comments * 2,
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10);

  // Subscriber growth series (count per week)
  const weeklyGrowth: Record<string, number> = {};
  for (const s of recentSubs) {
    const d = new Date(s.createdAt);
    const weekKey = `${d.getFullYear()}-W${Math.floor(d.getDate() / 7) + 1}-${d.getMonth()}`;
    weeklyGrowth[weekKey] = (weeklyGrowth[weekKey] || 0) + 1;
  }
  const growthWeeks = Object.entries(weeklyGrowth).slice(-12);

  const sentimentColors: Record<string, string> = {
    bullish: "#10b981",
    bearish: "#ef4444",
    neutral: "#64748b",
  };

  return (
    <section>
      <h1 className="page-title">Analytics</h1>
      <p className="page-subtitle">Your performance, accuracy, and engagement — last 90 days.</p>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <article className="card">
          <p className="metric-label">Accuracy (latest)</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {latestAccuracy.toFixed(1)}%
          </p>
        </article>
        <article className="card">
          <p className="metric-label">ROI (latest)</p>
          <p className="metric-value" style={{ fontSize: 34, color: latestROI >= 0 ? "#10b981" : "#ef4444" }}>
            {latestROI >= 0 ? "+" : ""}
            {latestROI.toFixed(2)}%
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Total Reactions</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {totalReactions.toLocaleString()}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Total Comments</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {totalComments.toLocaleString()}
          </p>
        </article>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16, alignItems: "start" }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Accuracy Trend — Last 90 days</h3>
          {accuracySeries.length === 0 ? (
            <p className="page-subtitle" style={{ margin: 0 }}>
              No metrics computed yet. Metrics refresh daily once you have approved posts.
            </p>
          ) : (
            <div style={{ marginTop: 16 }}>
              <svg viewBox="0 0 900 200" style={{ width: "100%", height: 200 }}>
                <polyline
                  points={accuracySeries
                    .map((v, i) => {
                      const x = (i / Math.max(1, accuracySeries.length - 1)) * 880 + 10;
                      const y = 180 - (v / maxAccuracy) * 160;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                />
                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = 180 - (tick / maxAccuracy) * 160;
                  return (
                    <g key={tick}>
                      <line x1={10} x2={890} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="2 3" />
                      <text x={0} y={y + 3} fontSize="10" fill="#94a3b8">
                        {tick}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Sentiment Distribution</h3>
          {postSentimentCounts.length === 0 ? (
            <p className="page-subtitle" style={{ margin: 0 }}>
              No approved posts yet.
            </p>
          ) : (
            <div style={{ marginTop: 12 }}>
              {postSentimentCounts.map((row) => {
                const totalPosts = postSentimentCounts.reduce((s, r) => s + r._count._all, 0);
                const pct = (row._count._all / totalPosts) * 100;
                return (
                  <div key={row.sentiment} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ textTransform: "capitalize", fontWeight: 600 }}>
                        {row.sentiment}
                      </span>
                      <span>
                        {row._count._all} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: sentimentColors[row.sentiment] ?? "#64748b",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16, alignItems: "start" }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Asset Focus</h3>
          {postAssetCounts.length === 0 ? (
            <p className="page-subtitle" style={{ margin: 0 }}>
              No approved posts yet.
            </p>
          ) : (
            <div style={{ marginTop: 12 }}>
              {postAssetCounts.map((row) => {
                const totalPosts = postAssetCounts.reduce((s, r) => s + r._count._all, 0);
                const pct = (row._count._all / totalPosts) * 100;
                return (
                  <div key={row.assetType} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ textTransform: "uppercase", fontWeight: 600 }}>{row.assetType}</span>
                      <span>{row._count._all}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#2563eb" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Subscriber Growth (90d)</h3>
          {growthWeeks.length === 0 ? (
            <p className="page-subtitle" style={{ margin: 0 }}>
              No new subscriptions in this window.
            </p>
          ) : (
            <div style={{ display: "flex", alignItems: "end", gap: 4, height: 120, marginTop: 16 }}>
              {growthWeeks.map(([week, count]) => {
                const max = Math.max(1, ...growthWeeks.map(([, c]) => c));
                return (
                  <div
                    key={week}
                    title={`${count} new subs`}
                    style={{
                      flex: 1,
                      height: `${(count / max) * 100}%`,
                      background: "linear-gradient(180deg, #10b981, #047857)",
                      borderRadius: 3,
                      minHeight: 4,
                    }}
                  />
                );
              })}
            </div>
          )}
        </article>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Top Posts by Engagement</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Symbol</th>
                <th>Sentiment</th>
                <th>Reactions</th>
                <th>Comments</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#61708b" }}>
                    No approved posts yet.
                  </td>
                </tr>
              ) : (
                ranked.map((p) => (
                  <tr key={p.id}>
                    <td style={{ maxWidth: 380, fontWeight: 600 }}>{p.title}</td>
                    <td>{p.marketSymbol ?? "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{p.sentiment}</td>
                    <td>{p._count.reactions}</td>
                    <td>{p._count.comments}</td>
                    <td style={{ fontWeight: 700 }}>{p.engagement}</td>
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
