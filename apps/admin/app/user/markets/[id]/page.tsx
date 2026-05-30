import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { FiHeart, FiMessageSquare } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import { CheckCircle } from "@/components/advisor-ui/icons";
import MarketPostDetailBody from "@/components/posts/market-post-detail-body";
import { isPostLocked, previewText } from "@/lib/post-access";

export const dynamic = "force-dynamic";

const SENTIMENT_COLORS: Record<string, string> = {
  bullish: "#16a34a",
  bearish: "#dc2626",
  neutral: "#64748b",
};

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

function formatINR(n: number, compact = false) {
  if (compact && Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);

  const postId = Number(params.id);
  if (!Number.isFinite(postId)) notFound();

  const post = await prisma.marketPost.findFirst({
    where: { id: postId, complianceStatus: "approved", deletedAt: null },
    include: {
      advisor: {
        select: {
          id: true,
          fullName: true,
          advisorProfile: {
            select: { sebiRegistrationNo: true, expertiseTags: true, bio: true },
          },
        },
      },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { fullName: true } } },
      },
      _count: { select: { reactions: true, comments: true } },
    },
  });

  if (!post) notFound();

  const postAccessType = (post.postAccessType ?? "free") as "free" | "paid";
  const isOwn = auth?.userId === post.advisorUserId;
  let isUnlocked = isOwn;
  if (auth && postAccessType === "paid" && !isOwn) {
    const unlock = await prisma.marketPostUnlock.findUnique({
      where: { postId_userId: { postId, userId: auth.userId } },
    });
    isUnlocked = Boolean(unlock);
  }
  const locked = isPostLocked({ postAccessType, isUnlocked, isOwn });
  const displayContent = locked ? previewText(post.content, 200) : post.content;

  const initials = (post.advisor?.fullName ?? "??")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sColor = SENTIMENT_COLORS[post.sentiment];

  return (
    <section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
        <div>
          <Link
            href="/user/markets"
            style={{ fontSize: 12, color: "#64748b", marginBottom: 12, display: "inline-block" }}
          >
            ← Markets
          </Link>

          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <Link
                href={`/user/advisors/${post.advisor?.id}`}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background:
                    "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                  color: "#0ea5e9",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 14,
                  fontWeight: 800,
                  flexShrink: 0,
                  textDecoration: "none",
                }}
              >
                {initials}
              </Link>
              <div style={{ flex: 1 }}>
                <Link
                  href={`/user/advisors/${post.advisor?.id}`}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0f172a",
                    textDecoration: "none",
                  }}
                >
                  {post.advisor?.fullName}
                  <CheckCircle size={14} style={{ color: "#10b981" }} />
                </Link>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {post.advisor?.advisorProfile?.sebiRegistrationNo} ·{" "}
                  {post.publishedAt ? relTime(post.publishedAt) : relTime(post.createdAt)}
                </div>
              </div>
              <span
                style={{
                  padding: "5px 14px",
                  borderRadius: 999,
                  background: `${sColor}1a`,
                  color: sColor,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {post.sentiment}
              </span>
            </div>

            <MarketPostDetailBody
              isAuthed={isAuthed}
              post={{
                id: post.id,
                title: post.title,
                content: displayContent,
                post_access_type: postAccessType,
                is_locked: locked,
                is_unlocked: isUnlocked,
              }}
            >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {post.marketSymbol && (
                <span
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: "#f1f5f9",
                    color: "#334155",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {post.marketSymbol}
                </span>
              )}
              <span
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: "#f1f5f9",
                  color: "#334155",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {post.assetType.toUpperCase()}
              </span>
              <span
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  background:
                    post.riskLevel === "high"
                      ? "#fee2e2"
                      : post.riskLevel === "medium"
                        ? "#fef3c7"
                        : "#d1fae5",
                  color:
                    post.riskLevel === "high"
                      ? "#991b1b"
                      : post.riskLevel === "medium"
                        ? "#92400e"
                        : "#047857",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "capitalize",
                }}
              >
                {post.riskLevel} risk
              </span>
              {post.timeframe && (
                <span
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: "#f1f5f9",
                    color: "#334155",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {post.timeframe}
                </span>
              )}
            </div>

            {(post.targetPrice || post.stopLossPrice) && (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "14px 16px",
                  background: "#f8fafc",
                  borderRadius: 10,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                {post.targetPrice && (
                  <span>
                    Target:{" "}
                    <strong style={{ color: "#16a34a" }}>
                      {formatINR(Number(post.targetPrice))}
                    </strong>
                  </span>
                )}
                {post.stopLossPrice && (
                  <span>
                    Stop Loss:{" "}
                    <strong style={{ color: "#dc2626" }}>
                      {formatINR(Number(post.stopLossPrice))}
                    </strong>
                  </span>
                )}
              </div>
            )}

            <div
              style={{
                padding: 14,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 10,
                fontSize: 12,
                color: "#713f12",
                lineHeight: 1.5,
                fontStyle: "italic",
                marginBottom: 16,
              }}
            >
              <strong>Disclaimer:</strong> {post.disclaimer}
            </div>
            </MarketPostDetailBody>

            <div
              style={{
                paddingTop: 16,
                borderTop: "1px solid #eef0f4",
                display: "flex",
                gap: 16,
                alignItems: "center",
              }}
            >
              <AuthGate
                isAuthenticated={isAuthed}
                promptTitle="Sign in to react"
                promptDescription="Like this post and join the discussion. Sign up free."
              >
                <button
                  type="button"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "#f1f5f9",
                    color: "#0f172a",
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <FiHeart size={13} /> {post._count.reactions} Like
                </button>
              </AuthGate>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FiMessageSquare size={13} /> {post._count.comments} comments
              </span>
              <span style={{ flex: 1 }} />
              <AuthGate
                isAuthenticated={isAuthed}
                promptTitle="Sign in to follow"
                promptDescription="Follow this advisor to see all their sentiment posts."
              >
                <button
                  type="button"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#0ea5e9",
                    color: "#fff",
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Follow Advisor
                </button>
              </AuthGate>
            </div>
          </article>

          {/* Comments */}
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 24,
              marginTop: 16,
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              Comments ({post._count.comments})
            </h3>

            {!isAuthed && (
              <div
                style={{
                  padding: 14,
                  background: "#f0f9ff",
                  border: "1px dashed #7dd3fc",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#0c4a6e",
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                <Link
                  href="/login"
                  style={{ color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}
                >
                  Sign in
                </Link>{" "}
                to comment on this post
              </div>
            )}

            {post.comments.length === 0 ? (
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                No comments yet — be the first.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {post.comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid #f1f5f9",
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <strong style={{ fontSize: 13, color: "#0f172a" }}>{c.user.fullName}</strong>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        {relTime(c.createdAt)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        {/* Author profile sidebar */}
        <aside style={{ position: "sticky", top: 80 }}>
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "linear-gradient(135deg, #0ea5e9, #10b981)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 18,
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              {initials}
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: "#0f172a",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              {post.advisor?.fullName}
              <CheckCircle size={14} style={{ color: "#10b981" }} />
            </h3>
            <p style={{ margin: "4px 0 12px", fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
              {post.advisor?.advisorProfile?.sebiRegistrationNo}
            </p>

            {post.advisor?.advisorProfile?.bio && (
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  color: "#475569",
                  lineHeight: 1.55,
                }}
              >
                {post.advisor.advisorProfile.bio}
              </p>
            )}

            {(post.advisor?.advisorProfile?.expertiseTags?.length ?? 0) > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
                {post.advisor!.advisorProfile!.expertiseTags.slice(0, 6).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(14,165,233,0.08)",
                      color: "#0284c7",
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <Link
              href={`/user/advisors/${post.advisor?.id}`}
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px 14px",
                borderRadius: 10,
                background: "#f8fafc",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 12,
                textDecoration: "none",
                marginBottom: 8,
              }}
            >
              View profile
            </Link>
            <AuthGate
              isAuthenticated={isAuthed}
              promptTitle="Sign in to follow"
              promptDescription="Follow this advisor to see all their sentiment posts."
            >
              <button
                type="button"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0ea5e9, #10b981)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                + Follow
              </button>
            </AuthGate>
          </article>
        </aside>
      </div>
    </section>
  );
}
