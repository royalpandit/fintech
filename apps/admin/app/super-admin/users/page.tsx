import Link from "next/link";
import { prisma } from "@/lib/prisma";
import UsersFilters from "./users-filters";
import UserRowActions from "./user-row-actions";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  role?: string;
  status?: string;
  page?: string;
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: "#d1fae5", fg: "#047857" },
  pending: { bg: "#fef3c7", fg: "#92400e" },
  suspended: { bg: "#fee2e2", fg: "#991b1b" },
};

const ROLE_COLORS: Record<string, string> = {
  user: "#2563eb",
  advisor: "#10b981",
  admin: "#f59e0b",
  super_admin: "#7c3aed",
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
  if (role && ["user", "advisor", "admin", "super_admin"].includes(role)) where.role = role;
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
          lastLoginAt: true,
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
    <section className="advisor-scope" style={{ ["--advisor-primary" as any]: "#7c3aed" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: -0.6,
            }}
          >
            Users Management
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            Control identities, roles, and access status across the network
          </p>
        </div>
        <Link
          href="/super-admin/users/create"
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            background: "#7c3aed",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          + Create New User
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <article className="stat-card">
          <p className="stat-card-label">Total Users</p>
          <p className="stat-card-value">{totalUsers.toLocaleString()}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Pending Approvals</p>
          <p
            className="stat-card-value"
            style={{ color: pendingUsers > 0 ? "#f59e0b" : "var(--text-muted)" }}
          >
            {pendingUsers.toLocaleString()}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Suspended</p>
          <p
            className="stat-card-value"
            style={{ color: suspendedUsers > 0 ? "#dc2626" : "var(--text-muted)" }}
          >
            {suspendedUsers.toLocaleString()}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Email Verified</p>
          <p className="stat-card-value" style={{ color: "#10b981" }}>
            {verifiedEmails.toLocaleString()}
          </p>
        </article>
      </div>

      <UsersFilters initialQ={q} initialRole={role} initialStatus={status} />

      <article className="widget" style={{ padding: 0, overflow: "hidden", marginTop: 14 }}>
        {users.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 48,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No users match these filters.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {["User", "Phone", "Role", "Status", "Verified", "Last Login", "Joined", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 18px",
                        fontWeight: 600,
                        fontSize: 11,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const initials = user.fullName
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const sc = STATUS_COLORS[user.status] ?? STATUS_COLORS.active;
                  const roleColor = ROLE_COLORS[user.role] ?? "#94a3b8";
                  return (
                    <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 9,
                              background: roleColor + "22",
                              color: roleColor,
                              display: "grid",
                              placeItems: "center",
                              fontSize: 11,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{user.fullName}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td
                        style={{ padding: "14px 18px", fontFamily: "monospace", fontSize: 11 }}
                      >
                        {user.phone}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: roleColor + "1a",
                            color: roleColor,
                            textTransform: "capitalize",
                          }}
                        >
                          {user.role.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: sc.bg,
                            color: sc.fg,
                            textTransform: "capitalize",
                          }}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: user.emailVerifiedAt ? "#d1fae5" : "#f1f5f9",
                            color: user.emailVerifiedAt ? "#047857" : "#64748b",
                          }}
                        >
                          {user.emailVerifiedAt ? "Yes" : "No"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", color: "var(--text-muted)", fontSize: 11 }}>
                        {user.lastLoginAt ? user.lastLoginAt.toLocaleDateString() : "Never"}
                      </td>
                      <td style={{ padding: "14px 18px", color: "var(--text-muted)", fontSize: 11 }}>
                        {user.createdAt.toLocaleDateString()}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {user.role === "user" ? (
                          <UserRowActions
                            userId={user.id}
                            status={user.status}
                            emailVerified={Boolean(user.emailVerifiedAt)}
                          />
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div
            style={{
              padding: 14,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>
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
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
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
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#7c3aed",
                    color: "#fff",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
