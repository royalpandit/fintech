const kpis = [
  { label: "Total Sessions", value: "1.24M", delta: "+18.2%", tone: "success" },
  { label: "Active Advisors", value: "2,184", delta: "+6.4%", tone: "success" },
  { label: "Avg. Session Time", value: "14m 22s", delta: "-2.1%", tone: "danger" },
  { label: "Conversion to Paid", value: "8.7%", delta: "+1.3%", tone: "success" },
] as const;

const funnel = [
  { stage: "Visitor", value: "100%", width: "100%" },
  { stage: "Signup Started", value: "64%", width: "64%" },
  { stage: "KYC Completed", value: "41%", width: "41%" },
  { stage: "Advisor Connected", value: "23%", width: "23%" },
  { stage: "Paid Subscription", value: "8.7%", width: "8.7%" },
] as const;

const topSegments = [
  { name: "Equity Beginners", users: "42,180", growth: "+12.4%" },
  { name: "Long-term SIP Investors", users: "30,912", growth: "+9.1%" },
  { name: "Options Enthusiasts", users: "18,220", growth: "+3.6%" },
  { name: "Retirement Planning", users: "16,488", growth: "+6.8%" },
];

const campaigns = [
  { name: "Advisor Referral Sprint", ctr: "12.8%", conv: "4.2%", status: "Live" },
  { name: "Beginner Bootcamp Series", ctr: "9.1%", conv: "3.3%", status: "Live" },
  { name: "Tax-Saving Campaign", ctr: "8.6%", conv: "2.9%", status: "Paused" },
];

export default function AnalyticsPage() {
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
                {topSegments.map((segment) => (
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
