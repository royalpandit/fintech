import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import ProfileEditor from "./profile-editor";

export const dynamic = "force-dynamic";

export default async function AdvisorProfilePage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      fullName: true,
      email: true,
      phone: true,
      createdAt: true,
      lastLoginAt: true,
      advisorProfile: {
        select: {
          sebiRegistrationNo: true,
          experienceYears: true,
          bio: true,
          expertiseTags: true,
          profileImageUrl: true,
          verificationStatus: true,
          verifiedAt: true,
          verifiedBy: { select: { fullName: true } },
        },
      },
    },
  });

  if (!user) redirect("/login");
  const profile = user.advisorProfile;

  const sessions = await prisma.userSession.findMany({
    where: { userId: auth.userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
  });

  return (
    <section>
      <h1 className="page-title">Profile</h1>
      <p className="page-subtitle">
        Your advisor identity. SEBI-verified fields are read-only — contact support to update.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16, alignItems: "start" }}>
        <ProfileEditor
          initial={{
            fullName: user.fullName,
            bio: profile?.bio ?? "",
            expertiseTags: profile?.expertiseTags ?? [],
            profileImageUrl: profile?.profileImageUrl ?? "",
            experienceYears: profile?.experienceYears ?? 0,
          }}
        />

        <div style={{ display: "grid", gap: 16 }}>
          <article className="card">
            <h3 style={{ marginTop: 0 }}>SEBI Verification</h3>
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <p className="metric-label">Registration</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                  {profile?.sebiRegistrationNo ?? "—"}
                </p>
              </div>
              <div>
                <p className="metric-label">Status</p>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: "#d1fae5",
                    color: "#047857",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {profile?.verificationStatus ?? "—"}
                </span>
              </div>
              {profile?.verifiedAt && (
                <div>
                  <p className="metric-label">Verified</p>
                  <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>
                    {profile.verifiedAt.toLocaleDateString()}
                    {profile.verifiedBy?.fullName ? ` by ${profile.verifiedBy.fullName}` : ""}
                  </p>
                </div>
              )}
            </div>
          </article>

          <article className="card">
            <h3 style={{ marginTop: 0 }}>Contact</h3>
            <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
              <div>
                <span className="metric-label">Email</span>
                <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{user.email}</p>
              </div>
              <div>
                <span className="metric-label">Phone</span>
                <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{user.phone}</p>
              </div>
              <div>
                <span className="metric-label">Member since</span>
                <p style={{ margin: "4px 0 0" }}>{user.createdAt.toLocaleDateString()}</p>
              </div>
              <div>
                <span className="metric-label">Last login</span>
                <p style={{ margin: "4px 0 0" }}>
                  {user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "First session"}
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Active Sessions</h3>
        <div className="table-wrap">
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
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#61708b" }}>
                    No active sessions.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id}>
                    <td
                      style={{
                        maxWidth: 340,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.userAgent ?? "Unknown"}
                    </td>
                    <td>{s.ipAddress ?? "—"}</td>
                    <td>{s.createdAt.toLocaleString()}</td>
                    <td>{s.expiresAt?.toLocaleString() ?? "—"}</td>
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
