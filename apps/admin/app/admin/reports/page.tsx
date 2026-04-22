import { prisma } from "@/lib/prisma";

function statusTag(status: string) {
  if (status === "open") return <span className="tag danger">Open</span>;
  if (status === "resolved") return <span className="tag success">Resolved</span>;
  return <span className="tag">{status}</span>;
}

type SearchParams = { status?: string };

export default async function AdminReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const status = searchParams.status ?? "open";

  const where = status && ["open", "resolved", "dismissed"].includes(status)
    ? { status }
    : { status: "open" };

  const [openCount, resolvedCount, dismissedCount, rows] = await Promise.all([
    prisma.contentReport.count({ where: { status: "open" } }),
    prisma.contentReport.count({ where: { status: "resolved" } }),
    prisma.contentReport.count({ where: { status: "dismissed" } }),
    prisma.contentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        reporter: { select: { fullName: true, email: true } },
        resolvedBy: { select: { fullName: true } },
      },
    }),
  ]);

  const tabs = [
    { key: "open", label: `Open (${openCount})` },
    { key: "resolved", label: `Resolved (${resolvedCount})` },
    { key: "dismissed", label: `Dismissed (${dismissedCount})` },
  ];

  return (
    <section>
      <h1 className="page-title">Content Reports</h1>
      <p className="page-subtitle">Community-reported posts, comments, and profiles.</p>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`/admin/reports?status=${tab.key}`}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: status === tab.key ? "var(--primary)" : "#fff",
              color: status === tab.key ? "#fff" : "var(--text)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Content</th>
                <th>Reason</th>
                <th>Reporter</th>
                <th>Status</th>
                <th>Reported</th>
                <th>Resolved By</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "#61708b", padding: "20px 12px" }}>
                    No reports in this bucket.
                  </td>
                </tr>
              ) : (
                rows.map((report) => (
                  <tr key={report.id}>
                    <td style={{ fontWeight: 600 }}>
                      {report.contentKind} #{report.contentId}
                    </td>
                    <td style={{ maxWidth: 280 }}>{report.reason}</td>
                    <td>{report.reporter?.fullName ?? "—"}</td>
                    <td>{statusTag(report.status)}</td>
                    <td>{report.createdAt.toLocaleDateString()}</td>
                    <td>
                      {report.resolvedBy?.fullName ?? "—"}
                      {report.resolvedAt ? ` · ${report.resolvedAt.toLocaleDateString()}` : ""}
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
