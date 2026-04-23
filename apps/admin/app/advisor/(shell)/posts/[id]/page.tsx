import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import PostActions from "./post-actions";

export const dynamic = "force-dynamic";

function complianceColor(status: string) {
  if (status === "approved") return "#10b981";
  if (status === "flagged" || status === "rejected") return "#ef4444";
  return "#f59e0b";
}

export default async function AdvisorPostDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const postId = Number(params.id);
  if (!Number.isFinite(postId)) notFound();

  const post = await prisma.marketPost.findFirst({
    where: { id: postId, advisorUserId: auth.userId, deletedAt: null },
    include: {
      _count: { select: { comments: true, reactions: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { fullName: true } } },
      },
    },
  });

  if (!post) notFound();

  const latestComplianceLog = await prisma.complianceLog.findFirst({
    where: { module: "market_post", referenceId: postId },
    orderBy: { createdAt: "desc" },
  });

  const isEditable = post.complianceStatus !== "approved";

  return (
    <section>
      <Link
        href="/advisor/posts"
        className="page-subtitle"
        style={{ marginTop: 0, display: "inline-block" }}
      >
        ← My Posts
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginTop: 8 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 8 }}>
            {post.title}
          </h1>
          <p className="page-subtitle">
            {post.marketSymbol ? `${post.marketSymbol} · ` : ""}
            {post.assetType.toUpperCase()} ·{" "}
            <span style={{ textTransform: "capitalize" }}>{post.sentiment}</span> ·{" "}
            <span style={{ textTransform: "capitalize" }}>{post.riskLevel} risk</span>
          </p>
        </div>

        <PostActions postId={post.id} editable={isEditable} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16, alignItems: "start" }}>
        <article className="card">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: `${complianceColor(post.complianceStatus)}22`,
                color: complianceColor(post.complianceStatus),
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {post.complianceStatus}
            </span>
            <span style={{ fontSize: 12, color: "#61708b" }}>
              {post.publishedAt
                ? `Published ${post.publishedAt.toLocaleString()}`
                : `Created ${post.createdAt.toLocaleString()}`}
              {post.editedAt ? ` · Edited ${post.editedAt.toLocaleDateString()}` : ""}
            </span>
          </div>

          <p style={{ fontSize: 16, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>
            {post.content}
          </p>

          {(post.targetPrice || post.stopLossPrice || post.timeframe) && (
            <div
              style={{
                display: "flex",
                gap: 16,
                padding: "12px 16px",
                background: "#f8fafc",
                borderRadius: 12,
                marginTop: 16,
                fontSize: 13,
                flexWrap: "wrap",
              }}
            >
              {post.targetPrice && (
                <span>
                  Target: <strong>₹{Number(post.targetPrice).toLocaleString()}</strong>
                </span>
              )}
              {post.stopLossPrice && (
                <span>
                  Stop Loss: <strong>₹{Number(post.stopLossPrice).toLocaleString()}</strong>
                </span>
              )}
              {post.timeframe && (
                <span>
                  Timeframe: <strong>{post.timeframe}</strong>
                </span>
              )}
            </div>
          )}

          {post.disclaimer && (
            <p
              style={{
                marginTop: 16,
                padding: 12,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 10,
                fontSize: 12,
                fontStyle: "italic",
                color: "#713f12",
                lineHeight: 1.6,
              }}
            >
              <strong>Disclaimer:</strong> {post.disclaimer}
            </p>
          )}

          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 24,
              fontSize: 14,
            }}
          >
            <span>
              <strong>{post._count.reactions}</strong> ❤ likes
            </span>
            <span>
              <strong>{post._count.comments}</strong> 💬 comments
            </span>
          </div>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Compliance Audit</h3>
          {latestComplianceLog ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <p className="metric-label" style={{ marginBottom: 4 }}>
                  Status
                </p>
                <span
                  style={{
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: `${complianceColor(latestComplianceLog.status)}22`,
                    color: complianceColor(latestComplianceLog.status),
                  }}
                >
                  {latestComplianceLog.status}
                </span>
              </div>
              {latestComplianceLog.riskScore && (
                <div>
                  <p className="metric-label" style={{ marginBottom: 4 }}>
                    Risk Score
                  </p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>
                    {Number(latestComplianceLog.riskScore).toFixed(1)}
                    <span style={{ fontSize: 12, color: "#61708b", fontWeight: 400 }}> / 10</span>
                  </p>
                </div>
              )}
              {latestComplianceLog.notes && (
                <div>
                  <p className="metric-label" style={{ marginBottom: 4 }}>
                    Notes
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>
                    {latestComplianceLog.notes}
                  </p>
                </div>
              )}
              <p style={{ margin: 0, fontSize: 11, color: "#61708b" }}>
                {latestComplianceLog.createdAt.toLocaleString()} · by{" "}
                {latestComplianceLog.createdBy}
              </p>
            </div>
          ) : (
            <p className="page-subtitle" style={{ margin: 0 }}>
              No audit entries yet.
            </p>
          )}

          {!isEditable && (
            <div
              style={{
                marginTop: 16,
                padding: 10,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                fontSize: 12,
                color: "#065f46",
              }}
            >
              Approved posts are locked from editing. Create a new post with updated analysis if your view has changed.
            </div>
          )}
        </article>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Comments ({post._count.comments})</h3>
        {post.comments.length === 0 ? (
          <p className="page-subtitle" style={{ margin: 0 }}>
            No comments yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {post.comments.map((comment) => (
              <div
                key={comment.id}
                style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <strong>{comment.user.fullName}</strong>
                  <span style={{ color: "#61708b", fontSize: 12 }}>
                    {comment.createdAt.toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 14 }}>{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
