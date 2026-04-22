import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const [
    pendingAdvisors,
    pendingPosts,
    flaggedPosts,
    openReports,
    recentActions,
    recentVerifications,
  ] = await Promise.all([
    prisma.advisorProfile.count({ where: { verificationStatus: "pending" } }),
    prisma.marketPost.count({ where: { complianceStatus: { in: ["pending", "under_review"] } } }),
    prisma.marketPost.count({ where: { complianceStatus: "flagged" } }),
    prisma.contentReport.count({ where: { status: "open" } }),
    prisma.auditLog.findMany({
      where: { module: { in: ["advisors", "market_posts", "users"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { fullName: true, role: true } } },
    }),
    prisma.advisorProfile.findMany({
      where: { verificationStatus: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  const queues = [
    {
      title: "Pending Advisor Verifications",
      value: pendingAdvisors,
      href: "/admin/advisors",
      color: "#f59e0b",
    },
    {
      title: "Posts Awaiting Review",
      value: pendingPosts,
      href: "/admin/market-posts",
      color: "#2563eb",
    },
    {
      title: "Flagged Market Posts",
      value: flaggedPosts,
      href: "/admin/market-posts?status=flagged",
      color: "#ef4444",
    },
    {
      title: "Open Content Reports",
      value: openReports,
      href: "/admin/reports",
      color: "#dc2626",
    },
  ];

  return (
    <section>
      <h1 className="page-title">Moderation Dashboard</h1>
      <p className="page-subtitle">
        Review advisor verifications, moderate market posts, and act on community reports.
      </p>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        {queues.map((q) => (
          <Link
            key={q.title}
            href={q.href}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article className="card" style={{ borderRadius: 14, cursor: "pointer" }}>
              <p className="metric-label" style={{ marginTop: 0 }}>{q.title}</p>
              <p className="metric-value" style={{ margin: "8px 0 0", fontSize: 42 }}>
                {q.value.toLocaleString()}
              </p>
              <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
                <div style={{ width: q.value > 0 ? "84%" : "6%", height: "100%", background: q.color }} />
              </div>
            </article>
          </Link>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", marginTop: 16, alignItems: "start" }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Next in Verification Queue</h3>
          {recentVerifications.length === 0 ? (
            <p className="page-subtitle" style={{ margin: 0 }}>
              No pending advisor verifications. Good work.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Advisor</th>
                    <th>SEBI ID</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVerifications.map((advisor) => (
                    <tr key={advisor.id}>
                      <td>{advisor.user?.fullName ?? "Advisor"}</td>
                      <td>{advisor.sebiRegistrationNo}</td>
                      <td>{advisor.createdAt.toLocaleDateString()}</td>
                      <td>
                        <Link
                          href={`/admin/advisors/${advisor.user?.id}`}
                          className="btn-primary"
                          style={{ padding: "6px 10px", borderRadius: 8, display: "inline-block" }}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Recent Moderation Actions</h3>
          {recentActions.length === 0 ? (
            <p className="page-subtitle" style={{ margin: 0 }}>
              No recent actions logged.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {recentActions.map((log) => (
                <li
                  key={log.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>{log.action}</strong>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {log.createdAt.toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
                    {log.actor?.fullName ?? "System"} · {log.module} · target {log.targetKind}#{log.targetId ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
