import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getMarketPostDetail(id: string) {
  const postId = Number(id);
  if (Number.isNaN(postId)) return null;

  const post = await prisma.marketPost.findUnique({
    where: { id: postId },
    include: {
      advisor: { select: { fullName: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { fullName: true } } },
      },
    },
  });

  if (!post) return null;

  return {
    title: post.title,
    author: post.advisor.fullName,
    advisorVerified: post.complianceStatus === "approved",
    publishedDate: post.publishedAt?.toLocaleDateString() ?? "Pending",
    sentimentLabel: post.sentiment.charAt(0).toUpperCase() + post.sentiment.slice(1),
    complianceStatus: post.complianceStatus,
    targetPrice: post.targetPrice?.toString() ?? "-",
    stopLossPrice: post.stopLossPrice?.toString() ?? "-",
    complianceRiskScore: post.complianceRiskScore?.toString() ?? "N/A",
    disclaimer: post.disclaimer,
    comments: post.comments.map((comment) => ({
      id: comment.id,
      author: comment.user.fullName,
      time: comment.createdAt.toLocaleString(),
      text: comment.content,
    })),
  };
}

export default async function MarketPostDetailPage({ params }: { params: { id: string } }) {
  const post = await getMarketPostDetail(params.id);

  if (!post) {
    return (
      <section>
        <h1 className="page-title">Post Not Found</h1>
        <p className="page-subtitle">No market post matches the requested ID.</p>
      </section>
    );
  }

  const complianceChecks = [
    { title: "Compliance Status", detail: `Current status: ${post.complianceStatus}`, tone: post.complianceStatus === "approved" ? "success" : post.complianceStatus === "flagged" ? "danger" : "warning" },
    { title: "Sentiment Review", detail: `Detected sentiment: ${post.sentimentLabel}`, tone: post.sentimentLabel === "Bullish" ? "success" : post.sentimentLabel === "Bearish" ? "danger" : "warning" },
    { title: "Risk Score", detail: `Compliance risk score: ${post.complianceRiskScore}`, tone: post.complianceRiskScore === "N/A" ? "warning" : "success" },
  ];

  return (
    <section>
      <p className="page-subtitle" style={{ marginTop: 0 }}>
        Market Posts / Post detail #{params.id}
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 className="page-title">MARKET POSTS</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="input" style={{ width: "auto", padding: "10px 14px", fontWeight: 700 }}>
            Hide Post
          </button>
          <button type="button" className="btn-primary" style={{ padding: "10px 14px" }}>
            ★ Feature Post
          </button>
          <button type="button" style={{ borderRadius: 12, border: "0", background: "#be2026", color: "#fff", padding: "10px 16px", fontWeight: 700 }}>
            Delete
          </button>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 14, gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <article className="card" style={{ borderRadius: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "linear-gradient(120deg, #0b1f3a, #6c9fff)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>
                {post.author
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 32 }}>{post.author}</p>
                <p className="page-subtitle" style={{ margin: 0 }}>
                  Market Advisor • <span style={{ color: "#0b5bb5", fontWeight: 700 }}>{post.advisorVerified ? "Verified" : "Unverified"}</span>
                </p>
              </div>
            </div>
            <p className="page-subtitle" style={{ margin: 0, textAlign: "right" }}>
              Posted on {post.publishedDate}
            </p>
          </div>

          <h2 style={{ marginTop: 16, marginBottom: 10, fontSize: 38, lineHeight: "46px", maxWidth: 920 }}>
            {post.title}
          </h2>
          <p className="page-subtitle" style={{ marginTop: 0, fontSize: 16, lineHeight: "28px" }}>
            {post.disclaimer}
          </p>
          <p className="page-subtitle" style={{ marginTop: 0, fontSize: 16, lineHeight: "28px" }}>
            Content is moderated by the platform and reflects advisor perspective.
          </p>
          <p style={{ marginTop: 6, marginBottom: 12, fontSize: 16 }}>
            Risk classification: <strong>{post.complianceStatus.toUpperCase()}</strong> • Sentiment: <strong>{post.sentimentLabel}</strong>
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ height: 230, borderRadius: 20, background: "linear-gradient(140deg,#031b34,#0b5bb5)", border: "1px solid #dbe4f4" }} />
            <div style={{ height: 230, borderRadius: 20, background: "linear-gradient(140deg,#0d1626,#274e83)", border: "1px solid #dbe4f4" }} />
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="tag success">❤</span>
              <strong>{post.comments.length * 7 + 120}</strong>
              <span className="metric-label">LIKES</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="tag">💬</span>
              <strong>{post.comments.length}</strong>
              <span className="metric-label">COMMENTS</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="tag">↗</span>
              <strong>{post.comments.length * 3 + 20}</strong>
              <span className="metric-label">SHARES</span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              {post.comments.slice(0, 3).map((comment) => {
                const badge = comment.author
                  .split(" ")
                  .map((word) => word[0])
                  .join("");
                return (
                  <span key={comment.id} style={{ width: 24, minWidth: 24, height: 24, borderRadius: 999, background: "linear-gradient(120deg,#0058ba,#6c9fff)", color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>
                    {badge}
                  </span>
                );
              })}
              {post.comments.length > 3 ? (
                <span style={{ minWidth: 36, height: 24, borderRadius: 999, background: "#eef1f3", color: "var(--text-muted)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, padding: "0 8px" }}>
                  +{post.comments.length - 3}
                </span>
              ) : null}
            </div>
          </div>
        </article>

        <div style={{ display: "grid", gap: 16 }}>
          <article className="card" style={{ borderRadius: 24 }}>
            <h3 style={{ marginTop: 0, letterSpacing: 0.7 }}>AI COMPLIANCE AUDIT</h3>
            <div style={{ marginTop: 8, marginBottom: 10 }}>
              <p className="metric-label" style={{ marginBottom: 6 }}>
                POST SENTIMENT
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#dce7fb", overflow: "hidden" }}>
                  <div style={{ width: post.complianceStatus === "approved" ? "84%" : post.complianceStatus === "flagged" ? "64%" : "44%", height: "100%", background: "#0b5bb5" }} />
                </div>
                <strong style={{ color: "#0b5bb5" }}>{post.sentimentLabel}</strong>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {complianceChecks.map((check) => (
                <div key={check.title} style={{ borderRadius: 12, border: `1px solid ${check.tone === "warning" ? "#f8d8a8" : check.tone === "success" ? "#cce7d8" : "#f4d2d2"}`, background: check.tone === "warning" ? "#fff8eb" : check.tone === "success" ? "#f7fcf9" : "#fff2f2", padding: 10 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>{check.title}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{check.detail}</p>
                </div>
              ))}
            </div>
            <button type="button" className="input" style={{ width: "100%", marginTop: 10, textAlign: "center", fontWeight: 700 }}>
              View Full AI Report →
            </button>
          </article>

          <article className="card" style={{ borderRadius: 24 }}>
            <h3 style={{ marginTop: 0, letterSpacing: 1 }}>Author Profile</h3>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "linear-gradient(120deg,#0b1f3a,#6c9fff)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>
                {post.author
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 800 }}>{post.author}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                  Advisor post • <span style={{ color: "#0b5bb5" }}>{post.complianceStatus.toUpperCase()}</span>
                </p>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <button type="button" className="input" style={{ width: "100%", fontWeight: 700, color: "#0b5bb5" }}>
                ✉ Review advisor history
              </button>
              <button type="button" className="input" style={{ width: "100%", fontWeight: 700, color: "#7a2ea0" }}>
                ⚠ Flag this author
              </button>
              <button type="button" className="input" style={{ width: "100%", fontWeight: 700, color: "#be2026" }}>
                ⛔ Restrict posting
              </button>
            </div>
          </article>

          <article className="card" style={{ borderRadius: 24 }}>
            <h3 style={{ marginTop: 0, letterSpacing: 1 }}>Engagement Velocity</h3>
            <div style={{ display: "flex", alignItems: "end", gap: 8, height: 86, marginTop: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => {
                const height = 16 + (post.comments.length * (i + 1)) / 2;
                return (
                  <div key={i} style={{ width: 18, borderRadius: 6, background: i > 3 && i < 7 ? "#3f7bd9" : "#d2d8e0", height: `${height}px` }} />
                );
              })}
            </div>
            <p style={{ marginBottom: 0, marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
              Last 24 hours: <span style={{ color: "#0b5bb5", fontWeight: 700 }}>{post.comments.length > 0 ? `+${post.comments.length * 5}% engagement` : "No activity"}</span>
            </p>
          </article>
        </div>
      </div>

      <article className="card" style={{ marginTop: 16, borderRadius: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Comment Moderation</h3>
          <span className="tag">{post.comments.length} comments</span>
          <span style={{ marginLeft: "auto", color: "#0b5bb5", fontWeight: 700, fontSize: 13 }}>Newest First</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 13 }}>Flagged Only</span>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {post.comments.map((comment) => (
            <div key={comment.id} style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 14, background: "#fff" }}>
              <p style={{ margin: 0, fontWeight: 800 }}>
                {comment.author} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)" }}>{comment.time}</span>
              </p>
              <p style={{ margin: "6px 0 0", color: "var(--text-muted)" }}>{comment.text}</p>
            </div>
          ))}
        </div>

        <button type="button" style={{ marginTop: 10, width: "100%", borderRadius: 14, border: "1px dashed #8db2ee", background: "#f9fbff", padding: "12px 14px", color: "#0b5bb5", fontWeight: 700 }}>
          Load {post.comments.length + 1} more comments
        </button>
      </article>
    </section>
  );
}

