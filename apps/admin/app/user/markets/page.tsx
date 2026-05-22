import Link from "next/link";
import { cookies } from "next/headers";
import { FiHeart, FiMessageSquare } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import DonutChart from "@/components/advisor-ui/donut-chart";
import { CheckCircle } from "@/components/advisor-ui/icons";
import LiveMarketTicker from "@/components/live-market-ticker";
import LiveCandleChart from "@/components/live-candle-chart";

export const dynamic = "force-dynamic";

type SearchParams = { sentiment?: string; asset?: string };

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

export default async function UserMarketsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);

  const sentiment = searchParams.sentiment;
  const asset = searchParams.asset;

  const where: Record<string, unknown> = {
    complianceStatus: "approved",
    deletedAt: null,
  };
  if (sentiment && ["bullish", "bearish", "neutral"].includes(sentiment))
    where.sentiment = sentiment;
  if (asset && ["equity", "crypto", "mf", "commodity", "other"].includes(asset))
    where.assetType = asset;

  const [posts, sentimentMix, topSymbols, totalApproved] = await Promise.all([
    prisma.marketPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: 30,
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
    prisma.marketPost.groupBy({
      by: ["sentiment"],
      where: { complianceStatus: "approved", deletedAt: null },
      _count: { _all: true },
    }),
    prisma.marketPost.groupBy({
      by: ["marketSymbol"],
      where: {
        complianceStatus: "approved",
        deletedAt: null,
        marketSymbol: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 6,
    }),
    prisma.marketPost.count({
      where: { complianceStatus: "approved", deletedAt: null },
    }),
  ]);

  const sentimentSlices = [
    {
      label: "Bullish",
      value: sentimentMix.find((s) => s.sentiment === "bullish")?._count._all ?? 0,
      color: "#16a34a",
    },
    {
      label: "Bearish",
      value: sentimentMix.find((s) => s.sentiment === "bearish")?._count._all ?? 0,
      color: "#dc2626",
    },
    {
      label: "Neutral",
      value: sentimentMix.find((s) => s.sentiment === "neutral")?._count._all ?? 0,
      color: "#94a3b8",
    },
  ];
  const sentimentTotal = sentimentSlices.reduce((s, x) => s + x.value, 0);

  const sentimentTabs = [
    { key: "", label: `All (${totalApproved})`, color: "#0ea5e9" },
    {
      key: "bullish",
      label: `Bullish (${sentimentSlices[0].value})`,
      color: "#16a34a",
    },
    {
      key: "bearish",
      label: `Bearish (${sentimentSlices[1].value})`,
      color: "#dc2626",
    },
    {
      key: "neutral",
      label: `Neutral (${sentimentSlices[2].value})`,
      color: "#64748b",
    },
  ];

  return (
    <section>
      {/* ── Live Indices Strip ── */}
      <article
        style={{
          background: "#fff",
          border: "1px solid #eef0f4",
          borderRadius: 14,
          padding: "14px 18px",
          marginBottom: 18,
        }}
      >
        <h3
          style={{
            margin: "0 0 10px",
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Live Market Prices
        </h3>
        <LiveMarketTicker />
      </article>

      {/* ── Interactive Candlestick Chart ── */}
      <article
        style={{
          background: "#fff",
          border: "1px solid #eef0f4",
          borderRadius: 14,
          padding: 18,
          marginBottom: 18,
        }}
      >
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
          Chart — Historical OHLCV
        </h3>
        <LiveCandleChart defaultSymbol="NIFTY 50" />
      </article>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
        <div>
          <div style={{ marginBottom: 16 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: -0.5,
              }}
            >
              Advisor Sentiment Feed
            </h1>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
              SEBI-verified sentiment posts from regulated advisors
            </p>
          </div>

          {/* Sentiment filter tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {sentimentTabs.map((t) => {
              const active = (sentiment ?? "") === t.key;
              return (
                <Link
                  key={t.key || "all"}
                  href={t.key ? `/user/markets?sentiment=${t.key}` : "/user/markets"}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: active ? "#fff" : "#64748b",
                    background: active ? t.color : "#fff",
                    border: `1px solid ${active ? t.color : "#eef0f4"}`,
                    textDecoration: "none",
                  }}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          {/* Asset chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {[
              { key: "", label: "All assets" },
              { key: "equity", label: "Equity" },
              { key: "crypto", label: "Crypto" },
              { key: "mf", label: "Mutual Funds" },
              { key: "commodity", label: "Commodity" },
            ].map((a) => {
              const active = (asset ?? "") === a.key;
              const params = new URLSearchParams();
              if (sentiment) params.set("sentiment", sentiment);
              if (a.key) params.set("asset", a.key);
              return (
                <Link
                  key={a.key || "all"}
                  href={`/user/markets${params.toString() ? `?${params.toString()}` : ""}`}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    color: active ? "#0ea5e9" : "#64748b",
                    background: active ? "rgba(14, 165, 233, 0.08)" : "#fff",
                    border: "1px solid #eef0f4",
                    textDecoration: "none",
                  }}
                >
                  {a.label}
                </Link>
              );
            })}
          </div>

          {/* Posts feed */}
          <div style={{ display: "grid", gap: 12 }}>
            {posts.length === 0 ? (
              <article
                style={{
                  background: "#fff",
                  border: "1px solid #eef0f4",
                  borderRadius: 14,
                  padding: 32,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 13,
                }}
              >
                No posts in this filter.
              </article>
            ) : (
              posts.map((post) => {
                const sColor = SENTIMENT_COLORS[post.sentiment];
                const initials = (post.advisor?.fullName ?? "??")
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <article
                    key={post.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #eef0f4",
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
                      <Link
                        href={`/user/advisors/${post.advisor?.id}`}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 9,
                          background:
                            "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                          color: "#0ea5e9",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          flexShrink: 0,
                          textDecoration: "none",
                        }}
                      >
                        {initials}
                      </Link>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link
                          href={`/user/advisors/${post.advisor?.id}`}
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0f172a",
                            textDecoration: "none",
                          }}
                        >
                          {post.advisor?.fullName}
                          <CheckCircle size={12} style={{ color: "#10b981" }} />
                        </Link>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {post.advisor?.advisorProfile?.sebiRegistrationNo} ·{" "}
                          {post.publishedAt ? relTime(post.publishedAt) : relTime(post.createdAt)}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: `${sColor}1a`,
                          color: sColor,
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        {post.sentiment}
                      </span>
                    </div>

                    <Link
                      href={`/user/markets/${post.id}`}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <h3
                        style={{
                          margin: "0 0 8px",
                          fontSize: 17,
                          fontWeight: 700,
                          color: "#0f172a",
                          letterSpacing: -0.2,
                        }}
                      >
                        {post.title}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          color: "#334155",
                          lineHeight: 1.55,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {post.content}
                      </p>
                    </Link>

                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      {post.marketSymbol && (
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#f1f5f9",
                            color: "#334155",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {post.marketSymbol}
                        </span>
                      )}
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "#f1f5f9",
                          color: "#334155",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {post.assetType.toUpperCase()}
                      </span>
                      <span
                        style={{
                          padding: "4px 10px",
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
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      >
                        {post.riskLevel} risk
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: "1px solid #eef0f4",
                        display: "flex",
                        gap: 16,
                        alignItems: "center",
                      }}
                    >
                      <AuthGate
                        isAuthenticated={isAuthed}
                        promptTitle="Sign in to react"
                        promptDescription="Create a free account to like and engage with advisor posts."
                      >
                        <button
                          type="button"
                          style={{
                            border: "none",
                            background: "transparent",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            color: "#64748b",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <FiHeart size={13} /> {post._count.reactions}
                        </button>
                      </AuthGate>
                      <Link
                        href={`/user/markets/${post.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: "#64748b",
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        <FiMessageSquare size={13} /> {post._count.comments} comments
                      </Link>
                      <span style={{ flex: 1 }} />
                      <AuthGate
                        isAuthenticated={isAuthed}
                        promptTitle="Sign in to follow"
                        promptDescription="Follow this advisor to get all their sentiment posts in your feed."
                      >
                        <button
                          type="button"
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            background: "rgba(14, 165, 233, 0.08)",
                            color: "#0ea5e9",
                            fontSize: 12,
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          + Follow
                        </button>
                      </AuthGate>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        {/* Right rail */}
        <aside style={{ display: "grid", gap: 14, position: "sticky", top: 80 }}>
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 14,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              Sentiment Mix
            </h3>
            {sentimentTotal === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>
                No data yet.
              </p>
            ) : (
              <DonutChart
                slices={sentimentSlices.map((s) => ({ ...s, detail: `${s.value}` }))}
                centerLabel="Total"
                centerValue={`${sentimentTotal}`}
                size={150}
                thickness={20}
              />
            )}
          </article>

          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              Trending Symbols
            </h3>
            {topSymbols.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>
                No symbols tagged yet.
              </p>
            ) : (
              topSymbols.map((s) => (
                <Link
                  key={s.marketSymbol}
                  href={`/user/markets?asset=&symbol=${s.marketSymbol}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: "#f1f5f9",
                        color: "#475569",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {s.marketSymbol?.slice(0, 1)}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      {s.marketSymbol}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9" }}>
                    {s._count._all} posts
                  </span>
                </Link>
              ))
            )}
          </article>

          {!isAuthed && (
            <article
              style={{
                background: "linear-gradient(135deg, #f0fdf4, #ecfeff)",
                border: "1px solid #bbf7d0",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <h3 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 800 }}>
                Build your custom feed
              </h3>
              <p style={{ margin: "0 0 12px", fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                Sign up to follow advisors, save posts, and get personalized recommendations.
              </p>
              <Link
                href="/register"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0ea5e9, #16a34a)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                Get started — free
              </Link>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}
