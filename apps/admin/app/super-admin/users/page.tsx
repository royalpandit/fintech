const users = [
  { name: "Sophia Bennett", email: "sophia.b@flexi.io", role: "super_admin", status: "active" },
  { name: "Liam Carter", email: "liam.c@flexi.io", role: "moderator", status: "pending" },
  { name: "Olivia Harper", email: "olivia.h@flexi.io", role: "compliance", status: "inactive" },
  { name: "Noah Evans", email: "noah.e@flexi.io", role: "support", status: "active" },
  { name: "Emma Foster", email: "emma.f@flexi.io", role: "analyst", status: "active" },
];

function statusTag(status: string) {
  if (status === "active") return <span className="tag success">Active</span>;
  if (status === "pending") return <span className="tag">Pending</span>;
  return <span className="tag danger">Inactive</span>;
}

export default function UsersPage() {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="page-title">Users Management</h1>
          <p className="page-subtitle">Control identities, roles, and access status across the network.</p>
        </div>
        <a href="/super-admin/users/create" className="btn-primary">
          + Create New User
        </a>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 150px auto", gap: 12, alignItems: "center" }}>
          <input className="input" placeholder="Filter by name or email..." />
          <select className="input">
            <option>All Roles</option>
            <option>super_admin</option>
            <option>moderator</option>
            <option>compliance</option>
          </select>
          <select className="input">
            <option>Any Status</option>
            <option>active</option>
            <option>pending</option>
            <option>inactive</option>
          </select>
          <button className="btn-primary" type="button">
            Refresh
          </button>
        </div>
      </article>

      <article className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td style={{ textTransform: "capitalize" }}>{user.role.replace("_", " ")}</td>
                  <td>{statusTag(user.status)}</td>
                  <td>
                    <button type="button" style={{ marginRight: 8 }}>
                      Edit
                    </button>
                    <button type="button" style={{ marginRight: 8 }}>
                      View
                    </button>
                    <button type="button">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <article className="card">
          <p className="metric-label">Total Users</p>
          <p className="metric-value">1,248</p>
        </article>
        <article className="card">
          <p className="metric-label">Pending Approvals</p>
          <p className="metric-value">942</p>
        </article>
        <article className="card">
          <p className="metric-label">Locked Accounts</p>
          <p className="metric-value">12</p>
        </article>
        <article className="card">
          <p className="metric-label">2FA Enabled</p>
          <p className="metric-value">28</p>
        </article>
      </div>
    </section>
  );
}

