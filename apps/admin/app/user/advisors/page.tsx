import Link from "next/link";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import FollowToggle from "@/components/FollowToggle";
import { CheckCircle } from "@/components/advisor-ui/icons";
import { professionalTypeLabel, isProfessionalType } from "@/lib/professional-types";
import ProfileAvatar from "@/components/user/profile-avatar";
import FinanceProSearchBar from "./search-bar";

export const dynamic = "force-dynamic";

export default async function UserAdvisorsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);

  const query = (searchParams.q ?? "").trim();
  const typeFilter = isProfessionalType(searchParams.type) ? searchParams.type : null;

  const where: Prisma.UserWhereInput = {
    role: "advisor",
    deletedAt: null,
    advisorProfile: {
      verificationStatus: "approved",
      ...(typeFilter ? { professionalType: typeFilter } : {}),
    },
    ...(query ? { fullName: { contains: query, mode: "insensitive" } } : {}),
  };

  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);

  const [advisors, totalAdvisors] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        fullName: true,
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
    }),
    prisma.user.count({
      where: {
        role: "advisor",
        deletedAt: null,
        advisorProfile: { verificationStatus: "approved" },
      },
    }),
  ]);

  // Live counts for the listed advisors. The advisor_metric_daily rollup was
  // previously summed over 30 days, which double-counts snapshot metrics like
  // subscriber count (and is empty until the rollup job runs) — so both cards
  // and the stats strip read straight from the source tables instead.
  const advisorIds = advisors.map((a) => a.id);
  const [postRows, subRows, postsLast30] = await Promise.all([
    prisma.marketPost.groupBy({
      by: ["advisorUserId"],
      where: {
        advisorUserId: { in: advisorIds },
        complianceStatus: "approved",
        deletedAt: null,
        publishedAt: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.subscription.groupBy({
      by: ["advisorUserId"],
      where: { advisorUserId: { in: advisorIds }, status: "active" },
      _count: { _all: true },
    }),
    prisma.marketPost.count({
      where: {
        complianceStatus: "approved",
        deletedAt: null,
        publishedAt: { gte: thirty },
      },
    }),
  ]);

  const postsByAdvisor = new Map(postRows.map((r) => [r.advisorUserId, r._count._all]));
  const subsByAdvisor = new Map(subRows.map((r) => [r.advisorUserId, r._count._all]));
  const totalSubscribers = subRows.reduce((s, r) => s + r._count._all, 0);

  // Current user's real follow state for the listed advisors
  const followingSet = new Set<number>();
  if (auth) {
    const follows = await prisma.userFollow.findMany({
      where: {
        followerUserId: auth.userId,
        followingUserId: { in: advisors.map((a) => a.id) },
      },
      select: { followingUserId: true },
    });
    follows.forEach((f) => followingSet.add(f.followingUserId));
  }

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: -0.5,
          }}
        >
          Finance Professionals &amp; Businesses
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Search verified analysts, portfolio managers, advisory firms, listed companies &amp; platforms
        </p>
      </div>

      <FinanceProSearchBar />

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: typeFilter === "listed_company" ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Verified Professionals", value: totalAdvisors.toLocaleString(), color: "#10b981" },
          { label: "Avg Accuracy", value: "78%", color: "#0ea5e9" },
          { label: "Posts (30d)", value: postsLast30.toLocaleString(), color: "#f59e0b" },
          // Listed companies do not sell subscriptions — hide the subs aggregate for that filter.
          ...(typeFilter === "listed_company"
            ? []
            : [{ label: "Total Subscribers", value: totalSubscribers.toLocaleString(), color: "#7c3aed" }]),
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
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: s.color, letterSpacing: -0.5 }}>
              {s.value}
            </p>
          </article>
        ))}
      </div>

      {/* Advisor grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {advisors.length === 0 ? (
          <article
            style={{
              gridColumn: "1 / -1",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 32,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            {query || typeFilter
              ? "No finance professionals match your search."
              : "No verified finance professionals yet."}
          </article>
        ) : (
          advisors.map((adv) => {
            const postCount = postsByAdvisor.get(adv.id) ?? 0;
            const subCount = subsByAdvisor.get(adv.id) ?? 0;
            return (
              <article key={adv.id} className="fp-card">
                <Link
                  href={`/user/advisors/${adv.id}`}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    textDecoration: "none",
                    color: "inherit",
                    marginBottom: 12,
                  }}
                >
                  <ProfileAvatar
                    src={adv.advisorProfile?.profileImageUrl}
                    name={adv.fullName}
                    size={48}
                    radius={12}
                    fontSize={14}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text)",
                        display: "flex",
                        gap: 4,
                        alignItems: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {adv.fullName}
                      <CheckCircle size={12} style={{ color: "#10b981", flexShrink: 0 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {adv.advisorProfile?.sebiRegistrationNo}
                    </div>
                  </div>
                </Link>

                <div className="fp-card-tags">
                  <span className="fp-card-type">
                    {professionalTypeLabel(adv.advisorProfile?.professionalType)}
                  </span>
                  {adv.advisorProfile?.expertiseTags?.slice(0, 2).map((tag) => (
                    <span key={tag} className="fp-card-tag">
                      {tag}
                    </span>
                  ))}
                </div>

                {adv.advisorProfile?.bio && (
                  <p className="fp-card-bio">{adv.advisorProfile.bio}</p>
                )}

                {(() => {
                  const isListed = adv.advisorProfile?.professionalType === "listed_company";
                  const years = adv.advisorProfile?.experienceYears;
                  return (
                    <div
                      className="fp-card-stats"
                      style={{ gridTemplateColumns: isListed ? "repeat(2, 1fr)" : "repeat(3, 1fr)" }}
                    >
                      <div>
                        <p className="fp-card-stat-label">Posts</p>
                        <p className="fp-card-stat-value">{postCount}</p>
                      </div>
                      {!isListed && (
                        <div>
                          <p className="fp-card-stat-label">Subs</p>
                          <p className="fp-card-stat-value">{subCount}</p>
                        </div>
                      )}
                      <div>
                        <p className="fp-card-stat-label">Exp</p>
                        <p className="fp-card-stat-value">{years ? `${years}y` : "—"}</p>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Link href={`/user/advisors/${adv.id}`} className="fp-card-view">
                    View
                  </Link>
                  <AuthGate
                    isAuthenticated={isAuthed}
                    promptTitle="Sign in to follow"
                    promptDescription="Follow advisors to see their posts in your feed."
                  >
                    <div style={{ flex: 1, display: "flex" }}>
                      <FollowToggle
                        advisorId={adv.id}
                        initialFollowing={followingSet.has(adv.id)}
                        size="sm"
                        fullWidth
                      />
                    </div>
                  </AuthGate>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
