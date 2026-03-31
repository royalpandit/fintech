export default function ProfilePage() {
  return (
    <section>
      <h1 className="page-title">Admin Profile</h1>
      <p className="page-subtitle">Identity, role-based access, and security architecture.</p>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Account Details</h3>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p className="metric-label">Full Legal Name</p>
              <input className="input" value="Alexander Vance" readOnly />
            </div>
            <div>
              <p className="metric-label">Email Address</p>
              <input className="input" value="vance@observatory.ai" readOnly />
            </div>
            <div>
              <p className="metric-label">Employee ID</p>
              <input className="input" value="Alpha-Prime" readOnly />
            </div>
            <div>
              <p className="metric-label">Phone Extension</p>
              <input className="input" value="Global-X" readOnly />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <p className="metric-label">Bio</p>
            <textarea
              className="input"
              rows={4}
              readOnly
              value="Head of Global Operations and Infrastructure Security. Managing high-level node clusters and compliance across all modules."
            />
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Role Access</h3>
          <p className="page-subtitle">Current role has elevated moderation and compliance capabilities.</p>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <tbody>
                <tr>
                  <td>System Governance</td>
                  <td>Allowed</td>
                </tr>
                <tr>
                  <td>User Moderation</td>
                  <td>Allowed</td>
                </tr>
                <tr>
                  <td>Payment Override</td>
                  <td>Restricted</td>
                </tr>
                <tr>
                  <td>Risk Controls</td>
                  <td>Allowed</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}

