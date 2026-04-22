import Link from "next/link";
import { prisma } from "@/lib/prisma";
import UsersFilters from "./users-filters";

function statusTag(status: string) {
  if (status === "active") return <span className="tag success">Active</span>;
  if (status === "pending") return <span className="tag">Pending</span>;
  return <span className="tag danger">Suspended</span>;
}

type SearchParams = {
  q?: string;
  role?: string;
  status?: string;
  page?: string;
};

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? "").trim();
  const role = searchParams.role ?? "";
  const status = searchParams.status ?? "";
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const perPage = 20;

  const where: Record<string, unknown> = { deletedAt: null };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q.toLowerCase(), mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  if (role && ["user", "advisor", "admin"].includes(role)) where.role = role;
  if (status && ["active", "pending", "suspended"].includes(status)) where.status = status;

  const [users, filteredCount, totalUsers, pendingUsers, suspendedUsers, verifiedEmails] =
    await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { status: "pending", deletedAt: null } }),
      prisma.user.count({ where: { status: "suspended", deletedAt: null } }),
      prisma.user.count({ where: { emailVerifiedAt: { not: null }, deletedAt: null } }),
    ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / perPage));

  return (
    <section>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="page-title">Users Management</h1>
          <p className="page-subtitle">
            Control identities, roles, and access status across the network.
          </p>
        </div>
        <Link href="/super-admin/users/create" className="btn-primary">
          + Create New User
        </Link>
      </div>

      <UsersFilters initialQ={q} initialRole={role} initialStatus={status} />

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

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, fontSize: 13 }}>
            <span style={{ color: "#61708b" }}>
              Page {page} of {totalPages} · {filteredCount.toLocaleString()} results
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {page > 1 && (
                <Link
                  href={`/super-admin/users?${new URLSearchParams({
                    ...(q ? { q } : {}),
                    ...(role ? { role } : {}),
                    ...(status ? { status } : {}),
                    page: String(page - 1),
                  }).toString()}`}
                  className="input"
                  style={{ width: "auto", padding: "8px 14px", textDecoration: "none", color: "inherit" }}
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/super-admin/users?${new URLSearchParams({
                    ...(q ? { q } : {}),
                    ...(role ? { role } : {}),
                    ...(status ? { status } : {}),
                    page: String(page + 1),
                  }).toString()}`}
                  className="btn-primary"
                  style={{ padding: "8px 14px" }}
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
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
