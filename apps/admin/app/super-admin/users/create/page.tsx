export default function CreateUserPage() {
  return (
    <section>
      <p className="page-subtitle" style={{ marginTop: 0 }}>
        Users / Create User
      </p>
      <h1 className="page-title">Create New User</h1>
      <p className="page-subtitle">Set identity, role, status, and access scope for the account.</p>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16 }}>
        <article className="card">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <p className="metric-label">Full Name</p>
              <input className="input" placeholder="e.g. Jonathan Ive" />
            </div>
            <div>
              <p className="metric-label">Email Address</p>
              <input className="input" placeholder="name@company.com" />
            </div>
            <div>
              <p className="metric-label">Password</p>
              <input className="input" placeholder="********" />
            </div>
            <div>
              <p className="metric-label">Confirm Password</p>
              <input className="input" placeholder="********" />
            </div>
            <div>
              <p className="metric-label">Role</p>
              <select className="input">
                <option>Advisor</option>
                <option>User</option>
              </select>
            </div>
            <div>
              <p className="metric-label">Status</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-primary" type="button">
                  Active
                </button>
                <button type="button" className="input" style={{ width: "auto", padding: "12px 18px" }}>
                  Inactive
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <p className="metric-label">Notes</p>
            <textarea
              className="input"
              rows={6}
              placeholder="Optional internal note about this user..."
              style={{ resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button type="button" className="input" style={{ width: "auto", padding: "12px 20px" }}>
              Cancel
            </button>
            <button type="button" className="btn-primary">
              Create User
            </button>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Quick Guidance</h3>
          <p className="page-subtitle">Assign only minimum required permissions during onboarding.</p>
          <div className="card" style={{ marginTop: 12 }}>
            <p style={{ marginTop: 0, fontWeight: 600 }}>Default security baseline</p>
            <p className="page-subtitle">Force password reset on first login and enable 2FA for admins.</p>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <p style={{ marginTop: 0, fontWeight: 600 }}>Compliance note</p>
            <p className="page-subtitle">All identity and role changes are logged in the audit module.</p>
          </div>
        </article>
      </div>
    </section>
  );
}

