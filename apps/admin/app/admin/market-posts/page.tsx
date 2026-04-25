import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { status?: string };

function relTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  approved: { bg: "#d1fae5", fg: "#047857" },
  pending: { bg: "#fef3c7", fg: "#92400e" },
  under_review: { bg: "#fef3c7", fg: "#92400e" },
  flagged: { bg: "#fee2e2", fg: "#991b1b" },
  rejected: { bg: "#fee2e2", fg: "#7f1d1d" },
};

const SENTIMENT_COLORS: Record<string, string> = {
  bullish: "#16a34a",
  bearish: "#dc2626",
  neutral: "#64748b",
};

export default async function AdminMarketPostsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const status = searchParams.status ?? "pending";

  const where: Record<string, unknown> = { deletedAt: null };
  if (status === "pending") {
    where.complianceStatus = { in: ["pending", "under_review"] };
  } else if (["approved", "flagged", "rejected"].includes(status)) {
    where.complianceStatus = status;
  }

  const [posts, pendingC, approvedC, flaggedC, rejectedC] = await Promise.all([
    prisma.marketPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        advisor: {
          select: {
            id: true,
            fullName: true,
            advisorProfile: { select: { sebiRegistrationNo: true } },
          },
        },
        _count: { select: { reactions: true, comments: true } },
      },
    }),
    prisma.marketPost.count({
      where: { complianceStatus: { in: ["pending", "under_review"] }, deletedAt: null },
    }),
    prisma.marketPost.count({ where: { complianceStatus: "approved", deletedAt: null } }),
    prisma.marketPost.count({ where: { complianceStatus: "flagged", deletedAt: null } }),
    prisma.marketPost.count({ where: { complianceStatus: "rejected", deletedAt: null } }),
  ]);

  const tabs = [
    { key: "pending", label: `Pending (${pendingC})`, color: "#f59e0b" },
    { key: "approved", label: `Approved (${approvedC})`, color: "#10b981" },
    { key: "flagged", label: `Flagged (${flaggedC})`, color: "#ef4444" },
    { key: "rejected", label: `Rejected (${rejectedC})`, color: "#7f1d1d" },
  ];

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
            Post Moderation
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Approve, flag, or reject advisor sentiment posts
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {tabs.map((t) => {
          const value =
            t.key === "pending"
              ? pendingC
              : t.key === "approved"
                ? approvedC
                : t.key === "flagged"
                  ? flaggedC
                  : rejectedC;
          return (
            <Link
              key={t.key}
              href={`/admin/market-posts?status=${t.key}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article
                className="stat-card"
                style={{
                  cursor: "pointer",
                  borderColor: status === t.key ? t.color : "#eef0f4",
                }}
              >
                <p className="stat-card-label">{t.label.split(" (")[0]}</p>
                <p className="stat-card-value" style={{ color: t.color }}>
                  {value.toLocaleString()}
                </p>
              </article>
            </Link>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/market-posts?status=${t.key}`}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: status === t.key ? "#fff" : "#64748b",
              background: status === t.key ? "#2563eb" : "#fff",
              border: "1px solid #eef0f4",
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <article className="widget" style={{ padding: 0, overflow: "hidden" }}>
        {posts.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 48,
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            ✓ No posts in this bucket.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Post", "Advisor", "Sentiment", "Risk Score", "Engagement", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "" ? "right" : "left",
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
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const sc = STATUS_COLORS[post.complianceStatus] ?? STATUS_COLORS.pending;
                  const score = post.complianceRiskScore
                    ? Number(post.complianceRiskScore)
                    : null;
                  return (
                    <tr key={post.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <Link
                          href={`/admin/market-posts/${post.id}`}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            color: "#0f172a",
                            textDecoration: "none",
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 9,
                              background: `${SENTIMENT_COLORS[post.sentiment]}1a`,
                              color: SENTIMENT_COLORS[post.sentiment],
                              display: "grid",
                              placeItems: "center",
                              fontSize: 10,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {post.marketSymbol?.slice(0, 4) ?? "—"}
                          </div>
                          <div style={{ minWidth: 0, maxWidth: 360 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {post.title}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>
                              {post.assetType.toUpperCase()} ·{" "}
                              {post.publishedAt
                                ? `Pub ${relTime(post.publishedAt)}`
                                : `Created ${relTime(post.createdAt)}`}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          {post.advisor?.fullName ?? "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            fontFamily: "monospace",
                          }}
                        >
                          {post.advisor?.advisorProfile?.sebiRegistrationNo ?? "—"}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "14px 18px",
                          color: SENTIMENT_COLORS[post.sentiment],
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      >
                        {post.sentiment}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {score !== null ? (
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: score >= 7 ? "#fee2e2" : score >= 4 ? "#fef3c7" : "#d1fae5",
                              color: score >= 7 ? "#991b1b" : score >= 4 ? "#92400e" : "#047857",
                            }}
                          >
                            {score.toFixed(1)}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: 11, color: "#475569" }}>
                        {post._count.reactions} ❤ · {post._count.comments} 💬
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
                          {post.complianceStatus}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <Link
                          href={`/admin/market-posts/${post.id}`}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            background: "#2563eb",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
