import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { FiHeart, FiMessageSquare, FiMessageCircle } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import { CheckCircle } from "@/components/advisor-ui/icons";
import FollowToggle from "@/components/FollowToggle";
import SubscribeButton from "@/components/subscribe-button";
import { marketPostAudienceWhere } from "@/lib/post-visibility";
import { professionalTypeLabel } from "@/lib/professional-types";
import MessageAdvisorButton from "./MessageAdvisorButton";
import AdvisorServicesList from "@/components/advisor-services-list";
import { categoryLabel, isSubscriptionActive, yearlySavingsPct } from "@/lib/subscription-services";

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

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export default async function PublicAdvisorProfile({ params }: { params: { id: string } }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);

  const advisorUserId = Number(params.id);
  if (!Number.isFinite(advisorUserId)) notFound();

  const advisor = await prisma.user.findFirst({
    where: {
      id: advisorUserId,
      role: "advisor",
      deletedAt: null,
      advisorProfile: { verificationStatus: "approved" },
    },
    select: {
      id: true,
      fullName: true,
      createdAt: true,
      advisorProfile: {
        select: {
          sebiRegistrationNo: true,
          professionalType: true,
          experienceYears: true,
          bio: true,
          expertiseTags: true,
          profileImageUrl: true,
          verifiedAt: true,
        },
      },
    },
  });

  if (!advisor || !advisor.advisorProfile) notFound();

  // Current user's follow state for this advisor
  const isFollowing = auth
    ? Boolean(
        await prisma.userFollow.findUnique({
          where: {
            followerUserId_followingUserId: {
              followerUserId: auth.userId,
              followingUserId: advisorUserId,
            },
          },
        }),
      )
    : false;

  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);

  const audienceWhere = await marketPostAudienceWhere(auth?.userId ?? null);

  const [posts, latestMetrics, subscriberCount, courses, subscriptionServices, userServiceSubs] =
    await Promise.all([
      prisma.marketPost.findMany({
        where: {
          advisorUserId,
          complianceStatus: "approved",
          deletedAt: null,
          ...audienceWhere,
        },
        orderBy: { publishedAt: "desc" },
        take: 12,
        include: {
          _count: { select: { reactions: true, comments: true } },
        },
      }),
      prisma.advisorMetricDaily.findFirst({
        where: { advisorUserId },
        orderBy: { day: "desc" },
      }),
      prisma.subscription.count({ where: { advisorUserId, status: "active" } }),
      prisma.course.findMany({
        where: {
          advisorUserId,
          isPublished: true,
          deletedAt: null,
          complianceStatus: "approved",
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { _count: { select: { enrollments: true } } },
      }),
      prisma.advisorSubscriptionService.findMany({
        where: {
          advisorUserId,
          deletedAt: null,
          status: { in: ["active", "paused"] },
        },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              subscriptions: { where: { status: "active", endDate: { gt: new Date() } } },
            },
          },
        },
      }),
      auth
        ? prisma.subscription.findMany({
            where: { userId: auth.userId, advisorUserId, serviceId: { not: null } },
            select: { serviceId: true, status: true, planType: true, endDate: true },
          })
        : Promise.resolve([]),
    ]);

  const userSubByService = new Map(
    userServiceSubs
      .filter((s) => s.serviceId != null)
      .map((s) => [s.serviceId!, s]),
  );

  const serviceCards = subscriptionServices.map((s) => {
    const userSub = userSubByService.get(s.id);
    const monthly = Number(s.monthlyPrice);
    const yearly = Number(s.yearlyPrice);
    return {
      id: s.id,
      name: s.name,
      categoryLabel: categoryLabel(s.category),
      description: s.description,
      monthlyPrice: monthly,
      yearlyPrice: yearly,
      yearlySavingsPct: yearlySavingsPct(monthly, yearly),
      offerFreeTrial: s.offerFreeTrial,
      subscriberCount: s._count.subscriptions,
      isSubscribed: userSub ? isSubscriptionActive(userSub) : false,
      canSubscribe: s.status === "active" && !s.pauseNewSubscriptions,
    };
  });

  const legacySub = auth
    ? await prisma.subscription.findUnique({
        where: { userId_advisorUserId: { userId: auth.userId, advisorUserId } },
        select: { status: true, endDate: true },
      })
    : null;

  const isSubscribed = auth
    ? serviceCards.some((s) => s.isSubscribed) ||
      (legacySub?.status === "active" && Boolean(legacySub.endDate && new Date(legacySub.endDate) > new Date()))
    : false;

  const initials = advisor.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const accuracy = latestMetrics?.accuracyPct ? Number(latestMetrics.accuracyPct) : 0;

  return (
    <section>
      <Link
        href="/user/advisors"
        style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, display: "inline-block" }}
      >
        ← All Finance Professionals
      </Link>

      {/* Hero */}
      <article
        style={{
          background: "linear-gradient(135deg, #0f172a, #064e3b)",
          color: "#fff",
          borderRadius: 18,
          padding: 28,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 18,
              background: "linear-gradient(135deg, #0ea5e9, #10b981)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 28,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: -0.6,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              {advisor.fullName}
              <CheckCircle size={18} style={{ color: "#a7f3d0" }} />
            </h1>
            <span
              style={{
                display: "inline-block",
                margin: "8px 0 0",
                padding: "3px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {professionalTypeLabel(advisor.advisorProfile.professionalType)}
            </span>
            <p
              style={{
                margin: "4px 0 12px",
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
                fontFamily: "monospace",
              }}
            >
              SEBI {advisor.advisorProfile.sebiRegistrationNo} ·{" "}
              {advisor.advisorProfile.experienceYears
                ? `${advisor.advisorProfile.experienceYears}y experience`
                : "Experience —"}
            </p>
            {advisor.advisorProfile.bio && (
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.55,
                  maxWidth: 700,
                }}
              >
                {advisor.advisorProfile.bio}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isAuthed ? (
              <>
                <FollowToggle
                  advisorId={advisorUserId}
                  initialFollowing={isFollowing}
                  size="lg"
                />
                <MessageAdvisorButton
                  advisorId={advisorUserId}
                  isFollowing={isFollowing}
                  services={serviceCards}
                />
                <SubscribeButton
                  advisorId={advisorUserId}
                  initialSubscribed={isSubscribed}
                  services={serviceCards}
                />
              </>
            ) : (
              <AuthGate
                isAuthenticated={false}
                promptTitle="Sign in to follow"
                promptDescription="Follow this advisor to get their latest sentiment in your feed."
              >
                <button
                  type="button"
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.95)",
                    color: "#064e3b",
                    fontWeight: 600,
                    fontSize: 14,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Follow + Subscribe
                </button>
              </AuthGate>
            )}
          </div>
        </div>

        {(advisor.advisorProfile.expertiseTags?.length ?? 0) > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            {advisor.advisorProfile.expertiseTags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  color: "#a7f3d0",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Active Subscribers", value: subscriberCount.toLocaleString(), color: "#0ea5e9" },
          { label: "Accuracy", value: `${accuracy.toFixed(1)}%`, color: "#16a34a" },
          { label: "Approved Posts", value: posts.length.toLocaleString(), color: "#7c3aed" },
          {
            label: "Member Since",
            value: advisor.createdAt.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            }),
            color: "var(--text-muted)",
          },
        ].map((s) => (
          <article
            key={s.label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 6 }}>
              {s.label}
            </p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: s.color, letterSpacing: -0.5 }}>
              {s.value}
            </p>
          </article>
        ))}
      </div>

      <AdvisorServicesList services={serviceCards} advisorName={advisor.fullName} />

      {/* Posts feed */}
      <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>
        Recent Sentiment ({posts.length})
      </h2>

      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {posts.length === 0 ? (
          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 32,
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            No public posts yet.
          </article>
        ) : (
          posts.map((post) => {
            const sColor = SENTIMENT_COLORS[post.sentiment];
            return (
              <Link
                key={post.id}
                href={`/user/markets/${post.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
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
                      display: "flex",
                      gap: 8,
                      marginBottom: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 999,
                        background: `${sColor}1a`,
                        color: sColor,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {post.sentiment}
                    </span>
                    {post.marketSymbol && (
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: "var(--surface-2)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--text)",
                        }}
                      >
                        {post.marketSymbol}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                      {post.publishedAt ? relTime(post.publishedAt) : relTime(post.createdAt)}
                    </span>
                  </div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                    {post.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--text)",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {post.content}
                  </p>
                  <div
                    style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiHeart size={11} /> {post._count.reactions}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiMessageSquare size={11} /> {post._count.comments}</span>
                  </div>
                </article>
              </Link>
            );
          })
        )}
      </div>

      {/* Courses */}
      {courses.length > 0 && (
        <>
          <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>
            Courses ({courses.length})
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {courses.map((c) => (
              <article
                key={c.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 18,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 6px",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text)",
                  }}
                >
                  {c.title}
                </h3>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {c.description}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: "#0ea5e9" }}>
                    {Number(c.price) > 0 ? formatINR(Number(c.price)) : "Free"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {c._count.enrollments} enrolled
                  </span>
                </div>
                <AuthGate
                  isAuthenticated={isAuthed}
                  promptTitle="Sign in to enroll"
                  promptDescription="Sign up to enroll in courses and track your learning."
                >
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      marginTop: 10,
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "rgba(14,165,233,0.08)",
                      color: "#0ea5e9",
                      fontSize: 12,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Enroll
                  </button>
                </AuthGate>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
