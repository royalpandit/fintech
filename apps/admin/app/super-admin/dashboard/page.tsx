const metrics = [
  { label: "Total Network Users", value: "128,402", delta: "+8.7%", tone: "success" },
  { label: "Gross Revenue (MoM)", value: "$2.4M", delta: "+12.3%", tone: "success" },
  { label: "Certified Advisors", value: "1,894", delta: "-4.6%", tone: "danger" },
  { label: "Critical AI Alerts", value: "14", delta: "ACTION REQ", tone: "danger" },
] as const;

const activities = [
  {
    title: "New Advisor Application: Sarah Jenkins",
    body: "Credentials verified via AI Protocol 09",
    time: "2m ago",
    tone: "#1a73e8",
  },
  {
    title: "Payout Processed: $12,400.00",
    body: "Batch #8829 sent to Stripe Treasury",
    time: "7m ago",
    tone: "#00a574",
  },
  {
    title: "Policy Flag: Market Post #10922",
    body: "Auto-moderated for sensitive keywords",
    time: "11m ago",
    tone: "#ba1a1a",
  },
];

export default function DashboardPage() {
  return (
    <section>
      <h1 className="page-title">Control Tower Dashboard</h1>
      <p className="page-subtitle">Live operational intelligence across growth, risk, revenue, and compliance.</p>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        {metrics.map((metric) => (
          <article key={metric.label} className="card" style={{ minHeight: 150 }}>
            <p className="metric-label">{metric.label}</p>
            <p className="metric-value">{metric.value}</p>
            <div style={{ marginTop: 8 }}>
              <span className={`tag ${metric.tone === "danger" ? "danger" : "success"}`}>{metric.delta}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "2fr 1fr" }}>
        <article className="card" style={{ minHeight: 430 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Platform Growth Analytics</h3>
              <p className="page-subtitle" style={{ margin: "6px 0 0" }}>
                Multi-domain growth across users, advisors, and activity.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="tag">Weekly</span>
              <span className="tag success">Monthly</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 18,
              height: 300,
              borderRadius: 16,
              border: "1px solid var(--border)",
              background:
                "linear-gradient(180deg, rgba(26,115,232,0.08) 0%, rgba(26,115,232,0.02) 50%, rgba(26,115,232,0) 100%)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "0 0 32px 0",
                background:
                  "linear-gradient(90deg, transparent 0%, transparent 9%, rgba(148,163,184,0.18) 10%, transparent 11%, transparent 19%, rgba(148,163,184,0.18) 20%, transparent 21%, transparent 29%, rgba(148,163,184,0.18) 30%, transparent 31%, transparent 39%, rgba(148,163,184,0.18) 40%, transparent 41%, transparent 49%, rgba(148,163,184,0.18) 50%, transparent 51%, transparent 59%, rgba(148,163,184,0.18) 60%, transparent 61%, transparent 69%, rgba(148,163,184,0.18) 70%, transparent 71%, transparent 79%, rgba(148,163,184,0.18) 80%, transparent 81%, transparent 89%, rgba(148,163,184,0.18) 90%, transparent 91%)",
              }}
            />
            <svg viewBox="0 0 800 280" style={{ position: "absolute", inset: "10px 16px 32px 16px", width: "calc(100% - 32px)", height: "calc(100% - 42px)" }}>
              <polyline
                points="0,210 90,190 180,170 270,172 360,148 450,126 540,142 630,108 720,122 800,88"
                fill="none"
                stroke="#1a73e8"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <polyline
                points="0,220 90,214 180,200 270,190 360,178 450,170 540,164 630,154 720,144 800,138"
                fill="none"
                stroke="#00a574"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.75"
              />
            </svg>
            <div style={{ position: "absolute", left: 16, right: 16, bottom: 10, display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: 11, fontWeight: 700 }}>
              {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP"].map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
        </article>

        <article className="card" style={{ minHeight: 430 }}>
          <h3 style={{ margin: 0 }}>AI Compliance Engine</h3>
          <p className="page-subtitle" style={{ marginTop: 6 }}>
            Autonomous audit results
          </p>
          <div style={{ marginTop: 14 }}>
            {[
              { k: "Regulatory Adherence", v: 98, color: "#00a574" },
              { k: "Manipulation Detection", v: 85, color: "#1a73e8" },
              { k: "Unresolved Flags", v: 12, color: "#565f71" },
            ].map((item) => (
              <div key={item.k} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  <span>{item.k}</span>
                  <span style={{ color: item.color }}>{item.v}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "#eceef4", overflow: "hidden" }}>
                  <div style={{ width: `${item.v}%`, height: "100%", background: item.color }} />
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary" style={{ width: "100%", marginTop: 12 }} type="button">
            Open Full Audit Console
          </button>
        </article>
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "1fr 2fr" }}>
        <article className="card" style={{ minHeight: 278 }}>
          <h3 style={{ margin: 0 }}>Advisory Engagement</h3>
          <div style={{ marginTop: 14, height: 150, borderRadius: 12, background: "linear-gradient(180deg,#f5f8ff,#ffffff)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--text-muted)" }}>
            Engagement trend chart
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
            {["MON", "TUE", "WED", "THU", "FRI"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </article>

        <article className="card" style={{ minHeight: 278 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Recent Activity Feed</h3>
            <a href="#" style={{ color: "var(--primary)", fontSize: 12, fontWeight: 700 }}>
              View all
            </a>
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
            {activities.map((item) => (
              <div key={item.title} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto", gap: 12, alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--surface-2)" }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: item.tone }}>{item.title}</p>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>{item.body}</p>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>{item.time}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fef2f2" }} />
          <div>
            <h3 style={{ margin: 0 }}>AI Alerts Deep Analysis</h3>
            <p className="page-subtitle" style={{ margin: "4px 0 0" }}>
              Priority insights for operations leadership
            </p>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 16 }}>
          <article className="card" style={{ padding: 16 }}>
            <span className="tag success">Growth</span>
            <p style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>Advisor Acquisition Momentum</p>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Conversion velocity remains above baseline across inbound pipelines.
            </p>
          </article>
          <article className="card" style={{ padding: 16 }}>
            <span className="tag">Risk</span>
            <p style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>Moderation Queue Drift</p>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Pending review backlog increasing in one segment; rebalance reviewer load.
            </p>
          </article>
          <article className="card" style={{ padding: 16 }}>
            <span className="tag">Optimization</span>
            <p style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>Automation Opportunity</p>
            <p className="page-subtitle" style={{ margin: 0 }}>
              High-confidence patterns can be auto-resolved with policy-safe routing.
            </p>
          </article>
        </div>
      </article>
    </section>
  );
}

