import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; role?: string; status?: string };

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

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? "").trim();
  const role = searchParams.role ?? "";
  const status = searchParams.status ?? "";

  const where: Record<string, unknown> = {
    deletedAt: null,
    role: role && ["user", "advisor"].includes(role) ? role : { in: ["user", "advisor"] },
  };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q.toLowerCase(), mode: "insensitive" } },
    ];
  }
  if (status && ["active", "pending", "suspended"].includes(status)) where.status = status;

  const [users, total, totalUsers, totalAdvisors, suspendedCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
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
    prisma.user.count({ where: { role: "user", deletedAt: null } }),
    prisma.user.count({ where: { role: "advisor", deletedAt: null } }),
    prisma.user.count({ where: { status: "suspended", deletedAt: null } }),
  ]);

  return (
    <section className="advisor-scope" style={{ ["--advisor-primary" as any]: "#2563eb" }}>
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
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.6,
            }}
          >
            Users
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Read-only directory · only super admins can modify accounts
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <article className="stat-card">
          <p className="stat-card-label">Total Users</p>
          <p className="stat-card-value">{totalUsers.toLocaleString()}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Total Advisors</p>
          <p className="stat-card-value" style={{ color: "#10b981" }}>
            {totalAdvisors.toLocaleString()}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Suspended</p>
          <p
            className="stat-card-value"
            style={{ color: suspendedCount > 0 ? "#dc2626" : "#94a3b8" }}
          >
            {suspendedCount.toLocaleString()}
          </p>
        </article>
      </div>

      <article className="widget" style={{ marginBottom: 14 }}>
        <form method="GET">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 160px 160px auto",
              gap: 12,
              alignItems: "center",
            }}
          >
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name or email..."
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid #eef0f4",
                background: "#f8fafc",
                fontSize: 13,
                outline: "none",
              }}
            />
            <select
              name="role"
              defaultValue={role}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid #eef0f4",
                background: "#f8fafc",
                fontSize: 13,
                outline: "none",
              }}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="advisor">Advisor</option>
            </select>
            <select
              name="status"
              defaultValue={status}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid #eef0f4",
                background: "#f8fafc",
                fontSize: 13,
                outline: "none",
              }}
            >
              <option value="">Any Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
            <button
              type="submit"
              style={{
                height: 40,
                padding: "0 22px",
                borderRadius: 10,
                background: "#2563eb",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>
        </form>
      </article>

      <article className="widget" style={{ padding: 0, overflow: "hidden" }}>
        {users.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 48,
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            No users match these filters.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["User", "Role", "Status", "Email Verified", "Last Login", "Joined"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 18px",
                        fontWeight: 600,
                        fontSize: 11,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        borderBottom: "1px solid #eef0f4",
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
                    <tr key={user.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
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
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{user.fullName}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{user.email}</div>
                          </div>
                        </div>
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
                          {user.role}
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
                      <td style={{ padding: "14px 18px", color: "#475569" }}>
                        {user.emailVerifiedAt ? "✓" : "—"}
                      </td>
                      <td style={{ padding: "14px 18px", color: "#64748b", fontSize: 11 }}>
                        {user.lastLoginAt ? user.lastLoginAt.toLocaleDateString() : "Never"}
                      </td>
                      <td style={{ padding: "14px 18px", color: "#64748b", fontSize: 11 }}>
                        {user.createdAt.toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ margin: 0, padding: 12, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
          Showing {users.length} of {total.toLocaleString()} matching users
        </p>
      </article>
    </section>
  );
}
