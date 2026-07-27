import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { FiHeart, FiMessageSquare } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { canViewMarketPost } from "@/lib/post-visibility";
import AuthGate from "@/components/auth-gate";
import { CheckCircle } from "@/components/advisor-ui/icons";
import MarketPostDetailBody from "@/components/posts/market-post-detail-body";
import { isPostLocked, previewText } from "@/lib/post-access";
import TradePanel from "@/components/trades/trade-panel";
import PremiumTradeGate from "@/components/trades/premium-trade-gate";
import { tradeStatusMeta, potentialReturnPct, tradeSide, daysActive } from "@/lib/trades";

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
      // Trades Phase 1/2
      updates: { orderBy: { createdAt: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      _count: { select: { reactions: true, comments: true } },
    },
  });

  if (!post) notFound();

  // Similar trades — same symbol or asset type from other advisors.
  const similarTrades = await prisma.marketPost.findMany({
    where: {
      id: { not: post.id },
      complianceStatus: "approved",
      deletedAt: null,
      publishedAt: { not: null },
      audience: "public",
      OR: [
        post.marketSymbol ? { marketSymbol: post.marketSymbol } : {},
        { assetType: post.assetType },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      id: true,
      title: true,
      marketSymbol: true,
      sentiment: true,
      tradeStatus: true,
      advisor: { select: { fullName: true } },
    },
  });

  // Subscriber-only posts are hidden from non-subscribers (and guests).
  if (!(await canViewMarketPost(post, auth?.userId ?? null))) notFound();

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

  // Premium gate data (only needed when locked).
  const [subscriberCount, mySub] = locked
    ? await Promise.all([
        prisma.subscription.count({
          where: { advisorUserId: post.advisorUserId, status: "active" },
        }),
        auth
          ? prisma.subscription.findUnique({
              where: {
                userId_advisorUserId: { userId: auth.userId, advisorUserId: post.advisorUserId },
              },
              select: { status: true, endDate: true },
            })
          : null,
      ])
    : [0, null];
  const isSubscribed =
    !!mySub && mySub.status === "active" && !!mySub.endDate && new Date(mySub.endDate) > new Date();
  // Upside % computed server-side so the raw prices never reach a locked client.
  const gateReturnPct = potentialReturnPct({
    entryMin: post.entryPriceMin ? Number(post.entryPriceMin) : null,
    entryMax: post.entryPriceMax ? Number(post.entryPriceMax) : null,
    target: post.targetPrice ? Number(post.targetPrice) : null,
    side: tradeSide(post.sentiment),
  });

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
            style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, display: "inline-block" }}
          >
            ← Markets
          </Link>

          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
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
                  fontWeight: 600,
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
                    color: "var(--text)",
                    textDecoration: "none",
                  }}
                >
                  {post.advisor?.fullName}
                  <CheckCircle size={14} style={{ color: "#10b981" }} />
                </Link>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
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
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {post.sentiment}
              </span>
            </div>

            {locked ? (
              <>
                <h1 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: -0.3 }}>
                  {post.title}
                </h1>
                <PremiumTradeGate
                  postId={post.id}
                  isAuthed={isAuthed}
                  unlockPrice={post.unlockPrice ? Number(post.unlockPrice) : null}
                  precomputedReturnPct={gateReturnPct}
                  teaser={{
                    sentiment: post.sentiment,
                    exchange: post.exchange,
                    marketSymbol: post.marketSymbol,
                    tradeStatus: post.tradeStatus,
                    timeframeType: post.timeframeType,
                    riskLevel: post.riskLevel,
                  }}
                  advisor={{
                    id: post.advisor!.id,
                    fullName: post.advisor!.fullName,
                    subscriberCount,
                    isSubscribed,
                  }}
                />
              </>
            ) : (
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
                    background: "var(--surface-2)",
                    color: "var(--text)",
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
                  background: "var(--surface-2)",
                  color: "var(--text)",
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
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {post.timeframe}
                </span>
              )}
            </div>

            {!locked && (
              <div style={{ marginBottom: 16 }}>
                <TradePanel
                  data={{
                    sentiment: post.sentiment,
                    exchange: post.exchange,
                    marketSymbol: post.marketSymbol,
                    tradeStatus: post.tradeStatus,
                    timeframeType: post.timeframeType,
                    riskLevel: post.riskLevel,
                    conviction: post.conviction,
                    entryPriceMin: post.entryPriceMin ? Number(post.entryPriceMin) : null,
                    entryPriceMax: post.entryPriceMax ? Number(post.entryPriceMax) : null,
                    targetPrice: post.targetPrice ? Number(post.targetPrice) : null,
                    stopLossPrice: post.stopLossPrice ? Number(post.stopLossPrice) : null,
                  }}
                />
                {/* Days active + realised exit (Trades Phase 3) */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                  {daysActive(post.publishedAt) != null && (
                    <span>
                      <strong style={{ color: "var(--text)" }}>{daysActive(post.publishedAt)}</strong> day
                      {daysActive(post.publishedAt) === 1 ? "" : "s"} active
                    </span>
                  )}
                  {post.exitPrice != null && (
                    <span>
                      Exited @ <strong style={{ color: "var(--text)" }}>{formatINR(Number(post.exitPrice))}</strong>
                    </span>
                  )}
                  {post.exitReturnPct != null && (
                    <span>
                      Realised:{" "}
                      <strong style={{ color: Number(post.exitReturnPct) >= 0 ? "#16a34a" : "#dc2626" }}>
                        {Number(post.exitReturnPct) >= 0 ? "+" : ""}
                        {Number(post.exitReturnPct).toFixed(2)}%
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Chart gallery (Trades Phase 2) */}
            {!locked && post.images.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {post.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={img.url}
                      alt="Trade chart"
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        objectFit: "cover",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                      }}
                    />
                  </a>
                ))}
              </div>
            )}

            <div
              style={{
                padding: 14,
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.30)",
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
            )}

            <div
              style={{
                paddingTop: 16,
                borderTop: "1px solid var(--border)",
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
                    background: "var(--surface-2)",
                    color: "var(--text)",
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
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
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

          {/* Trade Timeline (Trades Phase 1) */}
          {!locked && post.updates.length > 0 && (
            <article
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 24,
                marginTop: 16,
              }}
            >
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                Trade Timeline
              </h3>
              <div className="trade-timeline">
                {post.updates.map((u, i) => (
                  <div key={u.id} className="trade-timeline-row">
                    <div className="trade-timeline-marker">
                      <span
                        className="trade-timeline-dot"
                        style={{ background: tradeStatusMeta(u.kind === "published" ? "awaiting_entry" : u.kind).tone }}
                      />
                      {i < post.updates.length - 1 && <span className="trade-timeline-line" />}
                    </div>
                    <div className="trade-timeline-body">
                      <div className="trade-timeline-head">
                        <strong>{u.title}</strong>
                        <span className="trade-timeline-time">{relTime(u.createdAt)}</span>
                      </div>
                      {u.note && <p className="trade-timeline-note">{u.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}

          {/* Similar Trades (Trades Phase 2) */}
          {similarTrades.length > 0 && (
            <article
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 24,
                marginTop: 16,
              }}
            >
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                Similar Trades
              </h3>
              <div style={{ display: "grid", gap: 10 }}>
                {similarTrades.map((t) => {
                  const st = tradeStatusMeta(t.tradeStatus);
                  return (
                    <Link
                      key={t.id}
                      href={`/user/markets/${t.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.title}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {t.marketSymbol ? `${t.marketSymbol} · ` : ""}
                          {t.advisor?.fullName}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: st.tone,
                          background: `${st.tone}1f`,
                          flexShrink: 0,
                        }}
                      >
                        {st.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </article>
          )}

          {/* Comments */}
          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 24,
              marginTop: 16,
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Comments ({post._count.comments})
            </h3>

            {!isAuthed && (
              <div
                style={{
                  padding: 14,
                  background: "rgba(14,165,233,0.12)",
                  border: "1px dashed rgba(14,165,233,0.45)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "var(--text)",
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
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
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
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <strong style={{ fontSize: 13, color: "var(--text)" }}>{c.user.fullName}</strong>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {relTime(c.createdAt)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
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
              background: "var(--surface)",
              border: "1px solid var(--border)",
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
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {initials}
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text)",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              {post.advisor?.fullName}
              <CheckCircle size={14} style={{ color: "#10b981" }} />
            </h3>
            <p style={{ margin: "4px 0 12px", fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
              {post.advisor?.advisorProfile?.sebiRegistrationNo}
            </p>

            {post.advisor?.advisorProfile?.bio && (
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  color: "var(--text)",
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
                background: "var(--surface-2)",
                color: "var(--text)",
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
