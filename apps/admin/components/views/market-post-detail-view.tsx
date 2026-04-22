import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PostModerationActions from "@/components/views/market-post-moderation-actions";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function MarketPostDetailView({
  postId,
  advisorHrefPrefix,
  backHref,
}: {
  postId: number;
  advisorHrefPrefix: string;
  backHref: string;
}) {
  if (!Number.isFinite(postId)) notFound();

  const post = await prisma.marketPost.findUnique({
    where: { id: postId },
    include: {
      advisor: {
        select: {
          id: true,
          fullName: true,
          advisorProfile: { select: { verificationStatus: true, sebiRegistrationNo: true } },
        },
      },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { fullName: true } } },
      },
    },
  });

  if (!post) notFound();

  const [likeCount, totalCommentCount, advisorPostCount, recentComplianceLog] = await Promise.all([
    prisma.marketReaction.count({ where: { postId, type: "like" } }),
    prisma.marketComment.count({ where: { postId, deletedAt: null } }),
    prisma.marketPost.count({ where: { advisorUserId: post.advisorUserId } }),
    prisma.complianceLog.findFirst({
      where: { module: "market_post", referenceId: postId },
      orderBy: { createdAt: "desc" },
      select: { status: true, notes: true, createdAt: true, createdBy: true },
    }),
  ]);

  const sentimentLabel = post.sentiment.charAt(0).toUpperCase() + post.sentiment.slice(1);
  const advisorVerified = post.advisor.advisorProfile?.verificationStatus === "approved";
  const riskScoreText =
    post.complianceRiskScore !== null ? Number(post.complianceRiskScore).toFixed(2) : "N/A";

  const complianceChecks = [
    {
      title: "Compliance Status",
      detail: `Current status: ${post.complianceStatus}`,
      tone:
        post.complianceStatus === "approved"
          ? "success"
          : post.complianceStatus === "flagged" || post.complianceStatus === "rejected"
            ? "danger"
            : "warning",
    },
    {
      title: "Sentiment Review",
      detail: `Detected sentiment: ${sentimentLabel}`,
      tone:
        post.sentiment === "bullish"
          ? "success"
          : post.sentiment === "bearish"
            ? "danger"
            : "warning",
    },
    {
      title: "Risk Score",
      detail: `Compliance risk score: ${riskScoreText}`,
      tone:
        riskScoreText === "N/A" ? "warning" : Number(riskScoreText) > 6 ? "danger" : "success",
    },
  ] as const;

  return (
    <section>
      <Link href={backHref} className="page-subtitle" style={{ marginTop: 0, display: "inline-block" }}>
        ← Market Posts / Post #{post.id}
      </Link>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
        }}
      >
        <h1 className="page-title">Market Post Review</h1>
        <PostModerationActions postId={post.id} currentStatus={post.complianceStatus} />
      </div>

      <div className="grid" style={{ marginTop: 14, gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <article className="card" style={{ borderRadius: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: "linear-gradient(120deg, #0b1f3a, #6c9fff)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {getInitials(post.advisor.fullName)}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 22 }}>{post.advisor.fullName}</p>
                <p className="page-subtitle" style={{ margin: 0 }}>
                  {post.advisor.advisorProfile?.sebiRegistrationNo ?? "No SEBI on file"} •{" "}
                  <span style={{ color: advisorVerified ? "#0b5bb5" : "#b45309", fontWeight: 700 }}>
                    {advisorVerified ? "Verified" : "Unverified"}
                  </span>
                </p>
              </div>
            </div>
            <p className="page-subtitle" style={{ margin: 0, textAlign: "right" }}>
              {post.publishedAt
                ? `Published ${post.publishedAt.toLocaleDateString()}`
                : `Draft (${post.createdAt.toLocaleDateString()})`}
            </p>
          </div>

          <h2 style={{ marginTop: 16, marginBottom: 10, fontSize: 28, lineHeight: "36px", maxWidth: 920 }}>
            {post.title}
          </h2>
          <p style={{ marginTop: 0, fontSize: 16, lineHeight: "28px", whiteSpace: "pre-wrap" }}>
            {post.content}
          </p>
          {post.disclaimer && (
            <p
              className="page-subtitle"
              style={{ marginTop: 12, fontSize: 13, lineHeight: "22px", fontStyle: "italic" }}
            >
              Disclaimer: {post.disclaimer}
            </p>
          )}

          <p style={{ marginTop: 12, marginBottom: 12, fontSize: 14 }}>
            Risk: <strong>{post.riskLevel.toUpperCase()}</strong> · Asset:{" "}
            <strong>{post.assetType.toUpperCase()}</strong>
            {post.marketSymbol ? ` · ${post.marketSymbol}` : ""} · Sentiment:{" "}
            <strong>{sentimentLabel}</strong>
          </p>

          {(post.targetPrice || post.stopLossPrice) && (
            <div
              style={{
                display: "flex",
                gap: 16,
                padding: "12px 16px",
                background: "#f8fafc",
                borderRadius: 12,
                marginBottom: 12,
                fontSize: 13,
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

          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 26,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="tag success">❤</span>
              <strong>{likeCount}</strong>
              <span className="metric-label">LIKES</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="tag">💬</span>
              <strong>{totalCommentCount}</strong>
              <span className="metric-label">COMMENTS</span>
            </div>
          </div>
        </article>

        <div style={{ display: "grid", gap: 16 }}>
          <article className="card" style={{ borderRadius: 24 }}>
            <h3 style={{ marginTop: 0, letterSpacing: 0.7 }}>AI COMPLIANCE AUDIT</h3>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {complianceChecks.map((check) => (
                <div
                  key={check.title}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${check.tone === "warning" ? "#f8d8a8" : check.tone === "success" ? "#cce7d8" : "#f4d2d2"}`,
                    background:
                      check.tone === "warning"
                        ? "#fff8eb"
                        : check.tone === "success"
                          ? "#f7fcf9"
                          : "#fff2f2",
                    padding: 10,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 800 }}>{check.title}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    {check.detail}
                  </p>
                </div>
              ))}
            </div>

            {recentComplianceLog && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "#f8fafc",
                  borderRadius: 10,
                  fontSize: 12,
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>Last moderation action</p>
                <p style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>
                  <strong>{recentComplianceLog.status}</strong> on{" "}
                  {recentComplianceLog.createdAt.toLocaleString()}
                  {recentComplianceLog.createdBy ? ` by ${recentComplianceLog.createdBy}` : ""}
                </p>
                {recentComplianceLog.notes && (
                  <p style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>
                    Notes: {recentComplianceLog.notes}
                  </p>
                )}
              </div>
            )}
          </article>

          <article className="card" style={{ borderRadius: 24 }}>
            <h3 style={{ marginTop: 0, letterSpacing: 1 }}>Author Profile</h3>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: "linear-gradient(120deg,#0b1f3a,#6c9fff)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {getInitials(post.advisor.fullName)}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 800 }}>{post.advisor.fullName}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                  {advisorPostCount} total posts
                </p>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <Link
                href={`${advisorHrefPrefix}/${post.advisor.id}`}
                className="input"
                style={{
                  display: "block",
                  width: "100%",
                  fontWeight: 700,
                  color: "#0b5bb5",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                View advisor profile →
              </Link>
            </div>
          </article>
        </div>
      </div>

      <article className="card" style={{ marginTop: 16, borderRadius: 24 }}>
        <h3 style={{ marginTop: 0 }}>Comments ({totalCommentCount})</h3>
        {post.comments.length === 0 ? (
          <p className="page-subtitle" style={{ margin: 0 }}>
            No comments yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {post.comments.map((comment) => (
              <div
                key={comment.id}
                style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <strong>{comment.user.fullName}</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {comment.createdAt.toLocaleString()}
                    {comment.toxicityScore !== null && Number(comment.toxicityScore) > 5
                      ? ` · ⚠ toxicity ${Number(comment.toxicityScore).toFixed(1)}`
                      : ""}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: "22px" }}>{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
