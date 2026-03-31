import Link from "next/link";

const advisorMap: Record<
  string,
  {
    name: string;
    category: string;
    headline: string;
    aum: string;
    exp: string;
    sebiId: string;
    score: number;
    clients: string;
    risk: string;
  }
> = {
  ina000012345: {
    name: "Aarav Mehta",
    category: "Verified",
    headline: "SEBI-registered advisor focused on equity and long-term wealth planning.",
    aum: "INR 450.2Cr",
    exp: "14 years",
    sebiId: "INA000012345",
    score: 94,
    clients: "1,248",
    risk: "Low (0.8)",
  },
  ina000088219: {
    name: "Neha Kapoor",
    category: "Pending",
    headline: "Multi-asset strategist with strong derivatives and risk-management background.",
    aum: "INR 128.4Cr",
    exp: "8 years",
    sebiId: "INA000088219",
    score: 72,
    clients: "512",
    risk: "Medium (1.9)",
  },
  ina000077211: {
    name: "Rohan Iyer",
    category: "Verified",
    headline: "Portfolio specialist serving high-net-worth and corporate advisory mandates.",
    aum: "INR 298.0Cr",
    exp: "11 years",
    sebiId: "INA000077211",
    score: 81,
    clients: "890",
    risk: "Low (1.1)",
  },
  ina000022334: {
    name: "Maya Patel",
    category: "Rejected",
    headline: "Application requires additional KYC and compliance documentation review.",
    aum: "INR 12.0Cr",
    exp: "3 years",
    sebiId: "INA000022334",
    score: 41,
    clients: "102",
    risk: "High (3.8)",
  },
};

function scoreColor(score: number) {
  if (score >= 85) return "#10b981";
  if (score >= 65) return "#f59e0b";
  return "#ef4444";
}

export default function AdvisorDetailPage({ params }: { params: { id: string } }) {
  const advisor = advisorMap[params.id] ?? advisorMap.ina000012345;

  return (
    <section>
      <Link href="/super-admin/advisors" className="page-subtitle" style={{ display: "inline-block", marginTop: 0 }}>
        Advisors / {advisor.name}
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "end", marginTop: 8 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 8 }}>
            {advisor.name}
          </h1>
          <p className="page-subtitle">{advisor.headline}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="input" style={{ width: "auto", padding: "12px 16px" }} type="button">
            Suspend
          </button>
          <button className="btn-primary" type="button">
            Approve KYC
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.35fr 1fr", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Profile Information</h3>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p className="metric-label">Full Legal Name</p>
              <input className="input" value={advisor.name} readOnly />
            </div>
            <div>
              <p className="metric-label">SEBI ID</p>
              <input className="input" value={advisor.sebiId} readOnly />
            </div>
            <div>
              <p className="metric-label">Experience</p>
              <input className="input" value={advisor.exp} readOnly />
            </div>
            <div>
              <p className="metric-label">Managed AUM</p>
              <input className="input" value={advisor.aum} readOnly />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <p className="metric-label">Category</p>
            <span className={`tag ${advisor.category === "Rejected" ? "danger" : advisor.category === "Verified" ? "success" : ""}`}>
              {advisor.category}
            </span>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Performance Metrics</h3>
          <p className="metric-label">Quality Score</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 180, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
              <div style={{ width: `${advisor.score}%`, height: "100%", background: scoreColor(advisor.score) }} />
            </div>
            <strong>{advisor.score}%</strong>
          </div>
          <div style={{ marginTop: 16 }}>
            <p className="metric-label">Active Clients</p>
            <p className="metric-value" style={{ fontSize: 28 }}>
              {advisor.clients}
            </p>
          </div>
          <div>
            <p className="metric-label">Risk Score</p>
            <p style={{ marginTop: 4, fontWeight: 600 }}>{advisor.risk}</p>
          </div>
        </article>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.35fr 1fr", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>SEBI Documentation</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>SEBI Registration Certificate</td>
                  <td>
                    <span className="tag success">Verified</span>
                  </td>
                  <td>
                    <button type="button">View</button>
                  </td>
                </tr>
                <tr>
                  <td>PAN & Aadhaar Bundle</td>
                  <td>
                    <span className="tag">{advisor.category === "Rejected" ? "Recheck Required" : "Under Review"}</span>
                  </td>
                  <td>
                    <button type="button">Open</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>KYC Timeline</h3>
          <p className="page-subtitle" style={{ marginTop: 0 }}>
            Identity verification completed
          </p>
          <p className="page-subtitle">Address proof confirmed</p>
          <p className="page-subtitle">Manual SEBI audit in progress</p>
          <Link href={`/super-admin/advisors/${params.id}/security-review`} className="btn-primary" style={{ marginTop: 12, display: "inline-block" }}>
            Trigger Security Review
          </Link>
        </article>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Internal Admin Notes</h3>
        <textarea
          className="input"
          rows={4}
          placeholder="Add a private note about this advisor's application..."
          style={{ resize: "vertical" }}
        />
        <div style={{ display: "flex", justifyContent: "end", marginTop: 12 }}>
          <button className="btn-primary" type="button">
            Save Note
          </button>
        </div>
      </article>
    </section>
  );
}

