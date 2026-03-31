import Link from "next/link";

export default function AdvisorSecurityReviewPage({ params }: { params: { id: string } }) {
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p className="page-subtitle" style={{ marginTop: 0 }}>
            Advisors / Verification Queue / Security Review
          </p>
          <h1 className="page-title">SEBI Document Verification</h1>
          <p className="page-subtitle">Run final authority-level checks before approval or rejection.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="input" style={{ width: "auto", padding: "10px 14px" }} type="button">
            Save Draft
          </button>
          <button className="btn-primary" type="button">
            Submit Decision
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Document Preview</h3>
          <div
            style={{
              height: 560,
              border: "1px solid var(--border)",
              borderRadius: 16,
              background: "linear-gradient(160deg, #ffffff, #f3f6fb)",
              display: "grid",
              placeItems: "center",
              color: "var(--text-muted)",
              fontSize: 14,
              textAlign: "center",
              padding: 16,
            }}
          >
            SEBI registration document preview area
            <br />
            (pan / zoom / rotate controls to be wired with actual file viewer)
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Verification Details</h3>
          <div className="grid" style={{ gap: 10 }}>
            <div>
              <p className="metric-label">Advisor Name</p>
              <input className="input" value="Vikram Malhotra" readOnly />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <p className="metric-label">SEBI Registration No.</p>
                <input className="input" value="INA200007742" readOnly />
              </div>
              <div>
                <p className="metric-label">License Batch ID</p>
                <input className="input" value="77421-2023" readOnly />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <p className="metric-label">Issued Date</p>
                <input className="input" value="01/15/2023" readOnly />
              </div>
              <div>
                <p className="metric-label">Expiry Date</p>
                <input className="input" value="01/14/2028" readOnly />
              </div>
            </div>
            <div>
              <p className="metric-label">Verification Notes</p>
              <textarea
                className="input"
                rows={4}
                placeholder="Enter verification notes, findings, or reason for rejection..."
                style={{ resize: "vertical" }}
              />
            </div>
          </div>
        </article>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Status Selection</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-primary" type="button">
            Approve
          </button>
          <button className="input" style={{ width: "auto", padding: "12px 16px" }} type="button">
            Request Re-Upload
          </button>
          <button className="input" style={{ width: "auto", padding: "12px 16px" }} type="button">
            Reject
          </button>
        </div>
        <p className="page-subtitle" style={{ marginBottom: 0, marginTop: 12 }}>
          Audit trail synced with compliance log. SLA: 48h.
        </p>
      </article>

      <article className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Need to return to advisor profile before final decision?
          </p>
          <Link href={`/super-admin/advisors/${params.id}`} className="btn-primary">
            Back to Advisor Profile
          </Link>
        </div>
      </article>
    </section>
  );
}

