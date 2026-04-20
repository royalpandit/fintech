import { prisma } from "@/lib/prisma";

function statusTag(status: string) {
  if (status === "active") return <span className="tag success">Active</span>;
  if (status === "pending") return <span className="tag">Pending</span>;
  return <span className="tag danger">Suspended</span>;
}

export default async function UsersPage() {
  const [users, totalUsers, pendingUsers, suspendedUsers, verifiedEmails] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, fullName: true, email: true, role: true, status: true, emailVerifiedAt: true },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { status: "pending" } }),
    prisma.user.count({ where: { status: "suspended" } }),
    prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
  ]);

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
            <option>admin</option>
            <option>advisor</option>
            <option>user</option>
          </select>
          <select className="input">
            <option>Any Status</option>
            <option>active</option>
            <option>pending</option>
            <option>suspended</option>
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
                <tr key={user.id}>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td style={{ textTransform: "capitalize" }}>{user.role}</td>
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
          <p className="metric-value">{totalUsers.toLocaleString()}</p>
        </article>
        <article className="card">
          <p className="metric-label">Pending Approvals</p>
          <p className="metric-value">{pendingUsers.toLocaleString()}</p>
        </article>
        <article className="card">
          <p className="metric-label">Suspended Accounts</p>
          <p className="metric-value">{suspendedUsers.toLocaleString()}</p>
        </article>
        <article className="card">
          <p className="metric-label">Verified Emails</p>
          <p className="metric-value">{verifiedEmails.toLocaleString()}</p>
        </article>
      </div>
    </section>
  );
}

