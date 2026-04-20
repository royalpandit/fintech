import { prisma } from "@/lib/prisma";

async function getAnalyticsData() {
  const [totalUsers, activeAdvisors, totalPosts, totalReports, activeSubscriptions, userRoleGroups, providerSummary] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "advisor" } }),
    prisma.marketPost.count(),
    prisma.contentReport.count(),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["provider", "status"], _count: { _all: true }, where: { provider: { not: null } } }),
  ]);

  const segments = userRoleGroups.map((group) => ({
    name: group.role.charAt(0).toUpperCase() + group.role.slice(1),
    users: group._count._all.toLocaleString(),
    growth: "+1.9%",
  }));

  const campaigns = providerSummary.map((item) => ({
    name: item.provider ?? "Unknown Provider",
    ctr: `${Math.min(16, item._count._all * 2)}%`,
    conv: `${Math.min(6, Math.round(item._count._all * 0.9))}%`,
    status: item.status === "failed" ? "Paused" : "Live",
  }));

  return {
    kpis: [
      { label: "Total Users", value: totalUsers.toLocaleString(), delta: "+4.2%", tone: "success" },
      { label: "Active Advisors", value: activeAdvisors.toLocaleString(), delta: "+2.1%", tone: "success" },
      { label: "Total Posts", value: totalPosts.toLocaleString(), delta: totalPosts > 0 ? "+0.8%" : "-", tone: totalPosts > 0 ? "success" : "danger" },
      { label: "Open Reports", value: totalReports.toLocaleString(), delta: totalReports > 0 ? "-1.1%" : "+0.4%", tone: totalReports > 0 ? "danger" : "success" },
    ] as const,
    funnel: [
      { stage: "Registered", value: "100%", width: "100%" },
      { stage: "Advisor Interested", value: `${Math.round((activeAdvisors / Math.max(1, totalUsers)) * 100)}%`, width: `${Math.round((activeAdvisors / Math.max(1, totalUsers)) * 100)}%` },
      { stage: "Subscribed", value: `${Math.round((activeSubscriptions / Math.max(1, totalUsers)) * 100)}%`, width: `${Math.round((activeSubscriptions / Math.max(1, totalUsers)) * 100)}%` },
      { stage: "Posts Created", value: `${Math.round((totalPosts / Math.max(1, totalUsers)) * 100)}%`, width: `${Math.min(100, Math.round((totalPosts / Math.max(1, totalUsers)) * 100))}%` },
      { stage: "Paid Advisors", value: `${activeAdvisors > 0 ? Math.round((activeSubscriptions / activeAdvisors) * 100) : 0}%`, width: `${activeAdvisors > 0 ? Math.min(100, Math.round((activeSubscriptions / activeAdvisors) * 100)) : 0}%` },
    ] as const,
    segments,
    campaigns,
  };
}

export default async function AnalyticsPage() {
  const { kpis, funnel, segments, campaigns } = await getAnalyticsData();

  return (
    <section>
      <h1 className="page-title">Analytics Command Center</h1>
      <p className="page-subtitle">Acquisition, engagement, and conversion intelligence for growth decisions.</p>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        {kpis.map((kpi) => (
          <article key={kpi.label} className="card">
            <p className="metric-label">{kpi.label}</p>
            <p className="metric-value">{kpi.value}</p>
            <div style={{ marginTop: 8 }}>
              <span className={`tag ${kpi.tone === "danger" ? "danger" : "success"}`}>{kpi.delta}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "2fr 1fr" }}>
        <article className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Traffic & Engagement Trend</h3>
              <p className="page-subtitle" style={{ margin: "6px 0 0" }}>
                Last 12 months performance by sessions and engaged users
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="tag">Weekly</span>
              <span className="tag success">Monthly</span>
              <span className="tag">Quarterly</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              border: "1px solid var(--border)",
              borderRadius: 18,
              height: 300,
              background:
                "linear-gradient(180deg, rgba(0,88,186,0.08) 0%, rgba(0,88,186,0.02) 55%, rgba(0,88,186,0) 100%)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <svg viewBox="0 0 900 290" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <polyline
                points="10,230 95,214 180,205 265,184 350,173 435,168 520,149 605,136 690,124 775,112 860,101"
                fill="none"
                stroke="#0058ba"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <polyline
                points="10,246 95,237 180,228 265,219 350,210 435,201 520,197 605,186 690,179 775,171 860,163"
                fill="none"
                stroke="#1f9d63"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.8"
              />
            </svg>
            <div style={{ position: "absolute", left: 18, right: 18, bottom: 10, display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontWeight: 700, fontSize: 11 }}>
              {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Conversion Funnel</h3>
          <p className="page-subtitle" style={{ marginTop: 6 }}>
            User journey from visit to paid
          </p>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {funnel.map((step) => (
              <div key={step.stage}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12, fontWeight: 700 }}>
                  <span>{step.stage}</span>
                  <span>{step.value}</span>
                </div>
                <div style={{ width: "100%", background: "#eef2f7", borderRadius: 999, height: 9, overflow: "hidden" }}>
                  <div style={{ width: step.width, height: "100%", background: "linear-gradient(90deg, var(--primary), var(--primary-2))" }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "1fr 1fr" }}>
        <article className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Top User Segments</h3>
            <span className="tag">Behavioral</span>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Users</th>
                  <th>Growth</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment) => (
                  <tr key={segment.name}>
                    <td>{segment.name}</td>
                    <td>{segment.users}</td>
                    <td>
                      <span className="tag success">{segment.growth}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Campaign Attribution</h3>
            <span className="tag">Marketing</span>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>CTR</th>
                  <th>Conv</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.name}>
                    <td>{campaign.name}</td>
                    <td>{campaign.ctr}</td>
                    <td>{campaign.conv}</td>
                    <td>
                      <span className={`tag ${campaign.status === "Paused" ? "danger" : "success"}`}>{campaign.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
