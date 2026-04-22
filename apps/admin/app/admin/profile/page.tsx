import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { DEFAULT_PERMISSION_MATRIX, FEATURES } from "@/lib/rbac";

export default async function AdminProfilePage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const [user, recentSessions, recentAuditActions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        uuid: true,
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
    prisma.userSession.findMany({
      where: { userId: auth.userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
    }),
    prisma.auditLog.count({ where: { actorUserId: auth.userId } }),
  ]);

  if (!user) redirect("/login");

  const permissions = DEFAULT_PERMISSION_MATRIX[user.role as keyof typeof DEFAULT_PERMISSION_MATRIX] ?? {};

  return (
    <section>
      <h1 className="page-title">Moderator Profile</h1>
      <p className="page-subtitle">Identity, sessions, and role-based access.</p>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", marginTop: 16 }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Account</h3>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p className="metric-label">Full Name</p>
              <input className="input" value={user.fullName} readOnly />
            </div>
            <div>
              <p className="metric-label">Email</p>
              <input className="input" value={user.email} readOnly />
            </div>
            <div>
              <p className="metric-label">Phone</p>
              <input className="input" value={user.phone} readOnly />
            </div>
            <div>
              <p className="metric-label">Role</p>
              <input
                className="input"
                value={user.role}
                readOnly
                style={{ textTransform: "capitalize" }}
              />
            </div>
          </div>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <p className="metric-label">Last Login</p>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "First session"}
              </p>
            </div>
            <div>
              <p className="metric-label">Audit Actions</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{recentAuditActions.toLocaleString()}</p>
            </div>
            <div>
              <p className="metric-label">Status</p>
              <p style={{ margin: 0, fontWeight: 600, textTransform: "capitalize" }}>{user.status}</p>
            </div>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Role Access</h3>
          <p className="page-subtitle">Your role's feature-level permissions.</p>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <tbody>
                {FEATURES.map((feature) => {
                  const actions = permissions[feature.key] ?? [];
                  return (
                    <tr key={feature.key}>
                      <td>{feature.label}</td>
                      <td style={{ textTransform: "capitalize", fontSize: 12, color: "#61708b" }}>
                        {actions.length === 0 ? "None" : actions.join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Active Sessions</h3>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Device / Agent</th>
                <th>IP</th>
                <th>Started</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: "#61708b" }}>
                    No active sessions.
                  </td>
                </tr>
              ) : (
                recentSessions.map((session) => (
                  <tr key={session.id}>
                    <td style={{ maxWidth: 340, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {session.userAgent ?? "Unknown"}
                    </td>
                    <td>{session.ipAddress ?? "—"}</td>
                    <td>{session.createdAt.toLocaleString()}</td>
                    <td>{session.expiresAt?.toLocaleString() ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
