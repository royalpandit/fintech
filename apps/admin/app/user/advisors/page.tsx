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
import ProfessionTag from "@/components/user/profession-tag";
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
            featuredUntil: true,
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
      {(() => {
        const stats = [
          { label: "Verified Professionals", value: totalAdvisors.toLocaleString(), color: "#10b981" },
          { label: "Avg Accuracy", value: "78%", color: "#0ea5e9" },
          { label: "Posts (30d)", value: postsLast30.toLocaleString(), color: "#f59e0b" },
          // Listed companies do not sell subscriptions — hide the subs aggregate for that filter.
          ...(typeFilter === "listed_company"
            ? []
            : [{ label: "Total Subscribers", value: totalSubscribers.toLocaleString(), color: "#7c3aed" }]),
        ];
        return (
          <div className="fp-stats" style={{ ["--fp-stat-cols" as string]: String(stats.length) }}>
            {stats.map((s) => (
              <article key={s.label} className="fp-stat" style={{ ["--fp-stat-accent" as string]: s.color }}>
                <p className="fp-stat-label">{s.label}</p>
                <p className="fp-stat-value">{s.value}</p>
              </article>
            ))}
          </div>
        );
      })()}

      {/* Result count — tells you whether a filter actually narrowed anything */}
      <div className="fp-resultbar">
        <h2>
          {typeFilter
            ? professionalTypeLabel(typeFilter)
            : query
              ? "Search results"
              : "All professionals"}
        </h2>
        <span>
          {advisors.length === 0
            ? "No matches"
            : `Showing ${advisors.length}${advisors.length === 24 ? "+" : ""} of ${totalAdvisors.toLocaleString()} verified`}
        </span>
      </div>

      {/* Advisor grid */}
      <div className="fp-grid">
        {advisors.length === 0 ? (
          <article className="fp-card-empty">
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              {query || typeFilter
                ? "No finance professionals match your search."
                : "No verified finance professionals yet."}
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
              {query || typeFilter
                ? "Try a different name, or widen the category filter."
                : "Verified analysts and advisory firms will appear here once approved."}
            </p>
            {(query || typeFilter) && (
              <Link
                href="/user/advisors"
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Clear filters
              </Link>
            )}
          </article>
        ) : (
          advisors.map((adv) => {
            const postCount = postsByAdvisor.get(adv.id) ?? 0;
            const subCount = subsByAdvisor.get(adv.id) ?? 0;
            const featured =
              adv.advisorProfile?.featuredUntil != null &&
              adv.advisorProfile.featuredUntil.getTime() > Date.now();
            const tags = adv.advisorProfile?.expertiseTags ?? [];
            return (
              <article key={adv.id} className="fp-card">
                <Link href={`/user/advisors/${adv.id}`} className="fp-card-head">
                  <ProfileAvatar
                    src={adv.advisorProfile?.profileImageUrl}
                    name={adv.fullName}
                    size={48}
                    radius={12}
                    fontSize={14}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fp-card-name">
                      <span>{adv.fullName}</span>
                      <CheckCircle size={12} style={{ color: "#10b981", flexShrink: 0 }} />
                    </div>
                    <div className="fp-card-sebi">{adv.advisorProfile?.sebiRegistrationNo}</div>
                  </div>
                  {featured && <span className="fp-card-featured">Featured</span>}
                </Link>

                <div className="fp-card-tags">
                  {/* Same colour-coded pill the feed uses, so a Research Analyst
                      reads the same everywhere in the product. */}
                  <ProfessionTag
                    professionalType={adv.advisorProfile?.professionalType ?? null}
                    title={professionalTypeLabel(adv.advisorProfile?.professionalType)}
                  />
                  {tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="fp-card-tag">
                      {tag}
                    </span>
                  ))}
                  {tags.length > 2 && (
                    <span className="fp-card-tag" title={tags.slice(2).join(", ")}>
                      +{tags.length - 2}
                    </span>
                  )}
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
