import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchParams = { status?: string };

const STATUS_OPTIONS = ["pending", "flagged", "under_review", "approved", "rejected"] as const;

export default async function AdminMarketPostsPage({ searchParams }: { searchParams: SearchParams }) {
  const status = searchParams.status;
  const isValidStatus = status && (STATUS_OPTIONS as readonly string[]).includes(status);
  const where = isValidStatus
    ? { complianceStatus: status as (typeof STATUS_OPTIONS)[number], deletedAt: null }
    : { complianceStatus: { in: ["pending", "under_review", "flagged"] as any }, deletedAt: null };

  const [pendingCount, flaggedCount, approvedCount, rejectedCount, rows] = await Promise.all([
    prisma.marketPost.count({ where: { complianceStatus: "pending", deletedAt: null } }),
    prisma.marketPost.count({ where: { complianceStatus: "flagged", deletedAt: null } }),
    prisma.marketPost.count({ where: { complianceStatus: "approved", deletedAt: null } }),
    prisma.marketPost.count({ where: { complianceStatus: "rejected", deletedAt: null } }),
    prisma.marketPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { advisor: { select: { id: true, fullName: true } } },
    }),
  ]);

  const current = status || "queue";

  const tabs = [
    { key: "queue", label: `Moderation queue (${pendingCount + flaggedCount})`, href: "/admin/market-posts" },
    { key: "flagged", label: `Flagged (${flaggedCount})`, href: "/admin/market-posts?status=flagged" },
    { key: "approved", label: `Approved (${approvedCount})`, href: "/admin/market-posts?status=approved" },
    { key: "rejected", label: `Rejected (${rejectedCount})`, href: "/admin/market-posts?status=rejected" },
  ];

  const statusTag = (s: string) => {
    const colors: Record<string, string> = {
      approved: "success",
      flagged: "danger",
      rejected: "danger",
      pending: "",
      under_review: "",
    };
    return <span className={`tag ${colors[s] ?? ""}`}>{s}</span>;
  };

  return (
    <section>
      <h1 className="page-title">Post Moderation</h1>
      <p className="page-subtitle">
        Review advisor market posts flagged by AI or awaiting human review.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
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
                <th>Title</th>
                <th>Advisor</th>
                <th>Symbol</th>
                <th>Sentiment</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ color: "#61708b", padding: "20px 12px" }}>
                    No posts in this bucket.
                  </td>
                </tr>
              ) : (
                rows.map((post) => (
                  <tr key={post.id}>
                    <td style={{ fontWeight: 600, maxWidth: 320 }}>{post.title}</td>
                    <td>{post.advisor?.fullName}</td>
                    <td>{post.marketSymbol ?? "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{post.sentiment}</td>
                    <td>{statusTag(post.complianceStatus)}</td>
                    <td>{post.createdAt.toLocaleDateString()}</td>
                    <td>
                      <Link
                        href={`/admin/market-posts/${post.id}`}
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
