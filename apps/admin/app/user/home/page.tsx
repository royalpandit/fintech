import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import DonutChart from "@/components/advisor-ui/donut-chart";
import { CheckCircle, Sparkle, Target } from "@/components/advisor-ui/icons";

export const dynamic = "force-dynamic";

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
  if (!n && n !== 0) return "₹0";
  if (compact && Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (compact && Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

const SENTIMENT_COLORS: Record<string, string> = {
  bullish: "#16a34a",
  bearish: "#dc2626",
  neutral: "#64748b",
};

export default async function UserHomePage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  const [
    me,
    trendingPosts,
    topAdvisors,
    sentimentMix,
    topSymbols,
    featuredCourses,
    totalUsers,
    totalAdvisors,
    totalApprovedPosts,
    portfolio,
    walletBalance,
    followingCount,
  ] = await Promise.all([
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true },
        })
      : Promise.resolve(null),
    prisma.marketPost.findMany({
      where: { complianceStatus: "approved", deletedAt: null },
      orderBy: { publishedAt: "desc" },
      take: 12,
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
    prisma.advisorMetricDaily.groupBy({
      by: ["advisorUserId"],
      where: {
        day: { gte: new Date(Date.now() - 30 * 86400_000) },
      },
      _sum: { earningsAmount: true, accuracyPct: true, subscribersCount: true },
      orderBy: { _sum: { subscribersCount: "desc" } },
      take: 6,
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
    prisma.course.findMany({
      where: { deletedAt: null, isPublished: true, complianceStatus: "approved" },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: {
        advisor: { select: { fullName: true } },
        _count: { select: { enrollments: true, reviews: true } },
      },
    }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { role: "advisor", deletedAt: null } }),
    prisma.marketPost.count({
      where: { complianceStatus: "approved", deletedAt: null },
    }),
    userId
      ? prisma.portfolio.findFirst({
          where: { userId },
          orderBy: { lastSyncedAt: "desc" },
        })
      : Promise.resolve(null),
    userId
      ? prisma.virtualWallet.findUnique({ where: { userId } })
      : Promise.resolve(null),
    userId
      ? prisma.userFollow.count({ where: { followerUserId: userId } })
      : Promise.resolve(0),
  ]);

  // Hydrate advisor users referenced by topAdvisors metrics
  const topAdvisorIds = topAdvisors.map((m) => m.advisorUserId);
  const topAdvisorUsers = topAdvisorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topAdvisorIds } },
        select: {
          id: true,
          fullName: true,
          advisorProfile: { select: { sebiRegistrationNo: true } },
        },
      })
    : [];
  const advisorById = new Map(topAdvisorUsers.map((u) => [u.id, u]));

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

  const portfolioValue = portfolio?.totalValue ? Number(portfolio.totalValue) : 0;
  const portfolioRisk = portfolio?.riskScore ? Number(portfolio.riskScore) : 0;
  const labBalance = walletBalance?.balance ? Number(walletBalance.balance) : 0;

  return (
    <section>
      {isAuthed ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <article
            style={{
              borderRadius: 18,
              padding: "24px 26px",
              background: "linear-gradient(135deg, #0c4a6e, #0ea5e9)",
              color: "#fff",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Sparkle size={18} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Your Daily Brief
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.6 }}>
              Hey {me?.fullName.split(" ")[0] ?? "there"} 👋
            </h1>
            <p
              style={{
                margin: "6px 0 16px",
                color: "rgba(255,255,255,0.78)",
                fontSize: 13,
              }}
            >
              {sentimentSlices[0].value} bullish · {sentimentSlices[1].value} bearish posts published.
              Stay informed.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link
                href="/user/markets"
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.95)",
                  color: "#0c4a6e",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Browse Markets
              </Link>
              <Link
                href="/user/lab"
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Open Virtual Lab
              </Link>
            </div>
          </article>

          <article
            className="widget"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, padding: 0 }}
          >
            <div
              style={{
                padding: 18,
                borderRight: "1px solid #eef0f4",
                borderBottom: "1px solid #eef0f4",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Portfolio
              </p>
              <p style={{ margin: "6px 0 4px", fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
                {portfolio ? formatINR(portfolioValue, true) : "—"}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                {portfolio ? `Risk ${portfolioRisk.toFixed(1)}/10` : "Not connected"}
              </p>
            </div>
            <div style={{ padding: 18, borderBottom: "1px solid #eef0f4" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Following
              </p>
              <p style={{ margin: "6px 0 4px", fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
                {followingCount}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>advisors</p>
            </div>
            <div style={{ padding: 18, borderRight: "1px solid #eef0f4" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Virtual Lab
              </p>
              <p style={{ margin: "6px 0 4px", fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
                {labBalance ? formatINR(labBalance, true) : "—"}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                {labBalance ? "Practice money" : "Not started"}
              </p>
            </div>
            <div style={{ padding: 18 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Health Score
              </p>
              <p
                style={{
                  margin: "6px 0 4px",
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: -0.5,
                  color: "#0ea5e9",
                }}
              >
                —
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Connect data</p>
            </div>
          </article>
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            borderRadius: 22,
            padding: "44px 36px",
            marginBottom: 24,
            background:
              "radial-gradient(800px 280px at 100% 0%, rgba(16, 185, 129, 0.25), transparent 60%), radial-gradient(800px 280px at 0% 100%, rgba(14, 165, 233, 0.3), transparent 60%), linear-gradient(135deg, #082f49 0%, #0c4a6e 60%, #064e3b 100%)",
            color: "#fff",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 32,
              alignItems: "center",
            }}
          >
            <div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: "rgba(255, 255, 255, 0.16)",
                  color: "#a7f3d0",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  marginBottom: 14,
                }}
              >
                <CheckCircle size={12} />
                SEBI-REGULATED · ZERO ADVISOR MISINFORMATION
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 36,
                  fontWeight: 800,
                  letterSpacing: -1.2,
                  lineHeight: 1.1,
                }}
              >
                Smarter investing,
                <br />
                <span
                  style={{
                    background: "linear-gradient(90deg, #a7f3d0, #7dd3fc)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  community-backed.
                </span>
              </h1>
              <p
                style={{
                  margin: "14px 0 22px",
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "rgba(255, 255, 255, 0.82)",
                  maxWidth: 540,
                }}
              >
                Get verified market sentiment from SEBI-registered advisors, track your portfolio's
                health, practice in our virtual lab, and learn from premium courses — all in one
                regulated network.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link
                  href="/register"
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.95)",
                    color: "#064e3b",
                    fontWeight: 800,
                    fontSize: 14,
                    textDecoration: "none",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
                  }}
                >
                  Create free account
                </Link>
                <Link
                  href="/login"
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "TOTAL ADVISORS", value: totalAdvisors.toLocaleString(), sub: "SEBI-verified" },
                {
                  label: "APPROVED INSIGHTS",
                  value: totalApprovedPosts.toLocaleString(),
                  sub: "compliance-checked",
                },
                { label: "COMMUNITY", value: totalUsers.toLocaleString(), sub: "members" },
                { label: "YOUR LAB", value: "₹10L", sub: "virtual capital" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.7)",
                      fontWeight: 600,
                    }}
                  >
                    {s.label}
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 26,
                      fontWeight: 800,
                      letterSpacing: -0.6,
                    }}
                  >
                    {s.value}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#a7f3d0" }}>{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main feed grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: -0.4,
              }}
            >
              Trending Sentiment
            </h2>
            <span
              style={{
                fontSize: 11,
                color: "#64748b",
                padding: "4px 10px",
                borderRadius: 999,
                background: "#fff",
                border: "1px solid #eef0f4",
              }}
            >
              Verified posts only
            </span>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {trendingPosts.length === 0 ? (
              <article
                className="widget"
                style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}
              >
                No approved posts yet — check back soon.
              </article>
            ) : (
              trendingPosts.map((post) => {
                const sColor = SENTIMENT_COLORS[post.sentiment];
                const initials = (post.advisor?.fullName ?? "??")
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <article key={post.id} className="widget" style={{ padding: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        marginBottom: 12,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 9,
                          background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                          color: "#0ea5e9",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {post.advisor?.fullName}
                          <CheckCircle size={12} style={{ color: "#10b981" }} />
                        </div>
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

                    <h3
                      style={{
                        margin: 0,
                        marginBottom: 8,
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

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      {post.marketSymbol && (
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#f1f5f9",
                            color: "#334155",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.4,
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
                      {post.targetPrice && (
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#f0fdf4",
                            color: "#047857",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Target {formatINR(Number(post.targetPrice), true)}
                        </span>
                      )}
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
                        promptDescription="Create a free account to react to advisor posts and join the conversation."
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
                          ❤ {post._count.reactions}
                        </button>
                      </AuthGate>
                      <AuthGate
                        isAuthenticated={isAuthed}
                        promptTitle="Sign in to comment"
                        promptDescription="Join the discussion. Sign in to leave comments on advisor sentiment posts."
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
                          💬 {post._count.comments}
                        </button>
                      </AuthGate>
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

          {!isAuthed && trendingPosts.length > 4 && (
            <article
              style={{
                marginTop: 16,
                padding: 24,
                borderRadius: 16,
                background: "linear-gradient(135deg, #ecfeff, #f0f9ff)",
                border: "1px solid #bae6fd",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                Want personalized sentiment?
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "#475569" }}>
                Sign up to follow specific advisors and build your own custom feed.
              </p>
              <Link
                href="/register"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0ea5e9, #10b981)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Get started — free
              </Link>
            </article>
          )}
        </div>

        <aside style={{ display: "grid", gap: 14, position: "sticky", top: 80 }}>
          <article className="widget">
            <div className="widget-title">
              <h3>Market Sentiment</h3>
            </div>
            {sentimentTotal === 0 ? (
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 12,
                  padding: "16px 0",
                }}
              >
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

          <article className="widget">
            <div className="widget-title">
              <h3>Top Advisors</h3>
              <Link href="/user/advisors">View all</Link>
            </div>
            {topAdvisors.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 12,
                  padding: "16px 0",
                }}
              >
                No advisors yet.
              </p>
            ) : (
              topAdvisors.slice(0, 5).map((row) => {
                const u = advisorById.get(row.advisorUserId);
                const initials = (u?.fullName ?? "??")
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <div
                    key={row.advisorUserId}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                        color: "#0ea5e9",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "flex",
                          gap: 4,
                          alignItems: "center",
                        }}
                      >
                        {u?.fullName ?? "Advisor"}
                        <CheckCircle size={11} style={{ color: "#10b981" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>
                        {row._sum.subscribersCount?.toLocaleString() ?? 0} subscribers
                      </div>
                    </div>
                    <AuthGate
                      isAuthenticated={isAuthed}
                      promptTitle="Sign in to follow"
                      promptDescription="Follow this advisor to see their sentiment posts in your feed."
                    >
                      <button
                        type="button"
                        style={{
                          padding: "4px 10px",
                          borderRadius: 8,
                          background: "rgba(14,165,233,0.08)",
                          color: "#0ea5e9",
                          fontSize: 11,
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </AuthGate>
                  </div>
                );
              })
            )}
          </article>

          <article className="widget">
            <div className="widget-title">
              <h3>Trending Symbols</h3>
            </div>
            {topSymbols.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 12,
                  padding: "16px 0",
                }}
              >
                No symbols tagged yet.
              </p>
            ) : (
              topSymbols.map((s) => (
                <div
                  key={s.marketSymbol}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: "#f1f5f9",
                        color: "#475569",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
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
                </div>
              ))
            )}
          </article>

          <article className="widget">
            <div className="widget-title">
              <h3>Featured Courses</h3>
              <Link href="/user/learn">View all</Link>
            </div>
            {featuredCourses.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 12,
                  padding: "16px 0",
                }}
              >
                No courses yet.
              </p>
            ) : (
              featuredCourses.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#0f172a",
                      marginBottom: 2,
                    }}
                  >
                    {c.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {c.advisor.fullName} · {c._count.enrollments} enrolled
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#0ea5e9" }}>
                      {c.price && Number(c.price) > 0 ? formatINR(Number(c.price), true) : "Free"}
                    </span>
                    <AuthGate
                      isAuthenticated={isAuthed}
                      promptTitle="Sign in to enroll"
                      promptDescription="Create an account to enroll in courses and track your learning."
                    >
                      <button
                        type="button"
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: "rgba(14,165,233,0.08)",
                          color: "#0ea5e9",
                          fontSize: 11,
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Enroll
                      </button>
                    </AuthGate>
                  </div>
                </div>
              ))
            )}
          </article>

          {!isAuthed && (
            <article
              className="widget"
              style={{
                background: "linear-gradient(135deg, #f0fdf4, #ecfeff)",
                borderColor: "#bbf7d0",
              }}
            >
              <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
                <Target size={20} style={{ color: "#0ea5e9" }} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Practice Risk-Free</h3>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                Get ₹10L of virtual capital to practice trading without risking real money.
              </p>
              <Link
                href="/register"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0ea5e9, #10b981)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                Open Virtual Lab →
              </Link>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}
