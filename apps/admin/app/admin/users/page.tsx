import { prisma } from "@/lib/prisma";

function statusTag(status: string) {
  if (status === "active") return <span className="tag success">Active</span>;
  if (status === "pending") return <span className="tag">Pending</span>;
  return <span className="tag danger">Suspended</span>;
}

type SearchParams = { q?: string; role?: string; status?: string };

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? "").trim();
  const role = searchParams.role ?? "";
  const status = searchParams.status ?? "";

  const where: Record<string, unknown> = { deletedAt: null };

  // Admin CANNOT see super_admin or admin accounts — only user / advisor
  (where as any).role = role && ["user", "advisor"].includes(role)
    ? role
    : { in: ["user", "advisor"] };

  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q.toLowerCase(), mode: "insensitive" } },
    ];
  }
  if (status && ["active", "pending", "suspended"].includes(status)) where.status = status;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <section>
      <h1 className="page-title">Users</h1>
      <p className="page-subtitle">
        Read-only directory. Only super admins can create, modify or remove accounts.
      </p>

      <form method="GET">
        <article className="card" style={{ marginTop: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 150px 150px auto",
              gap: 12,
              alignItems: "center",
            }}
          >
            <input
              name="q"
              className="input"
              placeholder="Filter by name or email..."
              defaultValue={q}
            />
            <select name="role" className="input" defaultValue={role}>
              <option value="">All Roles</option>
              <option value="advisor">Advisor</option>
              <option value="user">User</option>
            </select>
            <select name="status" className="input" defaultValue={status}>
              <option value="">Any Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
            <button type="submit" className="btn-primary">
              Apply
            </button>
          </div>
        </article>
      </form>

      <article className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "#61708b", padding: "20px 12px" }}>
                    No users match these filters.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 600 }}>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td>{user.phone}</td>
                    <td style={{ textTransform: "capitalize" }}>{user.role}</td>
                    <td>{statusTag(user.status)}</td>
                    <td>{user.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="page-subtitle" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          Showing {users.length} of {total.toLocaleString()} matching users.
        </p>
      </article>
    </section>
  );
}
