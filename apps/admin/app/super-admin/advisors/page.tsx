import Link from "next/link";

const summary = [
  { label: "Pending Verification", value: "20", color: "#f59e0b" },
  { label: "Approved Advisors", value: "320", color: "#10b981" },
  { label: "Rejected Applications", value: "15", color: "#ef4444" },
  { label: "Monthly Revenue", value: "INR 7,40,000", color: "#2563eb" },
] as const;

const topAdvisors = [
  { id: "ina000012345", name: "FinancialGuru", followers: "12,000", accuracy: "78%", revenue: "INR 80,000" },
  { id: "ina000088219", name: "MarketExpert", followers: "9,750", accuracy: "92%", revenue: "INR 1,00,000" },
  { id: "ina000077211", name: "StockStar", followers: "8,430", accuracy: "85%", revenue: "INR 60,000" },
  { id: "ina000022334", name: "InvestMentor", followers: "7,890", accuracy: "87%", revenue: "INR 60,000" },
] as const;

const pendingVerification = [
  { id: "ina000012345", name: "Rohit Sharma", sebiId: "AG12345", date: "Today" },
  { id: "ina000088219", name: "Amit Kapoor", sebiId: "AZ99765", date: "2 days ago" },
  { id: "ina000077211", name: "Neha Verma", sebiId: "BH34567", date: "3 days ago" },
  { id: "ina000022334", name: "Anil Mehta", sebiId: "MH65432", date: "5 days ago" },
] as const;

const recentApprovals = [
  { id: "ina000012345", name: "Ajay Malhotra", sebiId: "DL76645", date: "Today" },
  { id: "ina000088219", name: "Shweta Singg", sebiId: "WR67890", date: "1 day ago" },
  { id: "ina000077211", name: "Deepak Rao", sebiId: "HR54321", date: "4 days ago" },
  { id: "ina000022334", name: "Priya Saini", sebiId: "PB98765", date: "5 days ago" },
] as const;

export default function AdvisorsPage() {
  return (
    <section>
      <h1 className="page-title">ADVISOR OVERVIEW</h1>
      <p className="page-subtitle">Approval monitoring, verification queue, and advisor quality analytics.</p>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        {summary.map((item) => (
          <article key={item.label} className="card" style={{ borderRadius: 14, padding: 16 }}>
            <p className="metric-label" style={{ marginTop: 0 }}>
              {item.label}
            </p>
            <p className="metric-value" style={{ margin: "8px 0 0", fontSize: item.label === "Monthly Revenue" ? 38 : 42 }}>
              {item.value}
            </p>
            <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
              <div style={{ width: "74%", height: "100%", background: item.color }} />
            </div>
          </article>
        ))}
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <article className="card" style={{ borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Advisor Approval Trends</h3>
          <div style={{ height: 290, border: "1px solid var(--border)", borderRadius: 12, background: "#fbfdff", overflow: "hidden", position: "relative" }}>
            <svg viewBox="0 0 900 290" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
              <polyline points="35,250 120,206 210,176 300,148 390,154 480,136 570,122 660,110 750,90 850,72" fill="none" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
              <polyline points="35,262 120,242 210,218 300,176 390,150 480,154 570,108 660,96 750,82 850,70" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
              <polyline points="35,264 120,248 210,232 300,214 390,202 480,182 570,176 660,146 750,124 850,110" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", left: 18, right: 18, bottom: 10, display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: 11, fontWeight: 700 }}>
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#facc15" }} /> Pending
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#22c55e" }} /> Approved
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#f97316" }} /> Rejected
            </span>
          </div>
        </article>

        <article className="card" style={{ borderRadius: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 0 }}>Top Advisors</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="tag">Followers</span>
              <span className="tag">Accuracy</span>
              <span className="tag">Revenue</span>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {topAdvisors.map((advisor) => (
              <div key={advisor.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800 }}>
                    <Link href={`/super-admin/advisors/${advisor.id}`} style={{ color: "var(--text)" }}>
                      {advisor.name}
                    </Link>
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Followers {advisor.followers}</p>
                </div>
                <strong>{advisor.accuracy}</strong>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{advisor.revenue}</span>
                <Link href={`/super-admin/advisors/${advisor.id}`} className="btn-primary" style={{ padding: "6px 10px", borderRadius: 8, display: "inline-block" }}>
                  Verify
                </Link>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <article className="card" style={{ borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Pending Verification</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Advisor</th>
                  <th>SEBI ID</th>
                  <th>Verification Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingVerification.map((advisor) => (
                  <tr key={advisor.id}>
                    <td>
                      <Link href={`/super-admin/advisors/${advisor.id}`} style={{ color: "var(--primary)", fontWeight: 700 }}>
                        {advisor.name}
                      </Link>
                    </td>
                    <td>{advisor.sebiId}</td>
                    <td>{advisor.date}</td>
                    <td>
                      <Link href={`/super-admin/advisors/${advisor.id}`} className="btn-primary" style={{ padding: "6px 10px", borderRadius: 8, display: "inline-block" }}>
                        Verify
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card" style={{ borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Recent Approvals</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Advisor</th>
                  <th>SEBI ID</th>
                  <th>Approval Date</th>
                </tr>
              </thead>
              <tbody>
                {recentApprovals.map((advisor) => (
                  <tr key={`approved-${advisor.id}`}>
                    <td>
                      <Link href={`/super-admin/advisors/${advisor.id}`} style={{ color: "var(--text)", fontWeight: 700 }}>
                        {advisor.name}
                      </Link>
                    </td>
                    <td>{advisor.sebiId}</td>
                    <td>{advisor.date}</td>
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

