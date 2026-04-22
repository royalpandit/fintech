import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchParams = { status?: string };

export default async function AdminAdvisorsPage({ searchParams }: { searchParams: SearchParams }) {
  const statusFilter = searchParams.status;
  const where = statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)
    ? { verificationStatus: statusFilter as "pending" | "approved" | "rejected" }
    : { verificationStatus: "pending" as const };

  const [pendingCount, approvedCount, rejectedCount, rows] = await Promise.all([
    prisma.advisorProfile.count({ where: { verificationStatus: "pending" } }),
    prisma.advisorProfile.count({ where: { verificationStatus: "approved" } }),
    prisma.advisorProfile.count({ where: { verificationStatus: "rejected" } }),
    prisma.advisorProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { id: true, fullName: true, email: true, createdAt: true } } },
    }),
  ]);

  const current = statusFilter || "pending";

  const tabs = [
    { key: "pending", label: `Pending (${pendingCount})`, color: "#f59e0b" },
    { key: "approved", label: `Approved (${approvedCount})`, color: "#10b981" },
    { key: "rejected", label: `Rejected (${rejectedCount})`, color: "#ef4444" },
  ];

  return (
    <section>
      <h1 className="page-title">Verification Queue</h1>
      <p className="page-subtitle">Review SEBI-registered advisor applications. Approve, reject, or request changes.</p>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/advisors?status=${tab.key}`}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: current === tab.key ? "var(--primary)" : "#fff",
              color: current === tab.key ? "#fff" : "var(--text)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Advisor</th>
                <th>Email</th>
                <th>SEBI ID</th>
                <th>Experience</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "#61708b", padding: "20px 12px" }}>
                    No advisors in this bucket.
                  </td>
                </tr>
              ) : (
                rows.map((advisor) => (
                  <tr key={advisor.id}>
                    <td style={{ fontWeight: 600 }}>{advisor.user?.fullName ?? "—"}</td>
                    <td>{advisor.user?.email ?? "—"}</td>
                    <td>{advisor.sebiRegistrationNo}</td>
                    <td>{advisor.experienceYears ? `${advisor.experienceYears} yrs` : "—"}</td>
                    <td>{advisor.createdAt.toLocaleDateString()}</td>
                    <td>
                      <Link
                        href={`/admin/advisors/${advisor.user?.id}`}
                        className="btn-primary"
                        style={{ padding: "6px 12px", borderRadius: 8, display: "inline-block" }}
                      >
                        Review
                      </Link>
                    </td>
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
