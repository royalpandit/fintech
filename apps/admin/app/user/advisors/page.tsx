import Link from "next/link";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import FollowToggle from "@/components/FollowToggle";
import { CheckCircle } from "@/components/advisor-ui/icons";
import { professionalTypeLabel, isProfessionalType } from "@/lib/professional-types";
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

  const [advisors, advisorMetrics, totalAdvisors, serviceCounts] = await Promise.all([
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
            verifiedAt: true,
          },
        },
      },
    }),
    prisma.advisorMetricDaily.groupBy({
      by: ["advisorUserId"],
      where: { day: { gte: thirty } },
      _sum: { subscribersCount: true, accuracyPct: true, postsCount: true },
    }),
    prisma.user.count({
      where: {
        role: "advisor",
        deletedAt: null,
        advisorProfile: { verificationStatus: "approved" },
      },
    }),
    prisma.advisorSubscriptionService.groupBy({
      by: ["advisorUserId"],
      where: { deletedAt: null, status: "active" },
      _count: { _all: true },
    }),
  ]);

  const servicesByAdvisor = new Map(
    serviceCounts.map((row) => [row.advisorUserId, row._count._all]),
  );

  const metricsByAdvisor = new Map(
    advisorMetrics.map((m) => [
      m.advisorUserId,
      {
        subs: m._sum.subscribersCount ?? 0,
        accuracy: m._sum.accuracyPct ? Number(m._sum.accuracyPct) : 0,
        posts: m._sum.postsCount ?? 0,
      },
    ]),
  );

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
          Finance Professionals
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Search verified analysts, portfolio managers, advisory firms and more
        </p>
      </div>

      <FinanceProSearchBar />

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
          { label: "Verified Professionals", value: totalAdvisors.toLocaleString(), color: "#10b981" },
          { label: "Avg Accuracy", value: "78%", color: "#0ea5e9" },
          { label: "Posts (30d)", value: advisorMetrics.reduce((s, m) => s + (m._sum.postsCount ?? 0), 0).toLocaleString(), color: "#f59e0b" },
          { label: "Total Subscribers", value: advisorMetrics.reduce((s, m) => s + (m._sum.subscribersCount ?? 0), 0).toLocaleString(), color: "#7c3aed" },
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
            const m = metricsByAdvisor.get(adv.id);
            const initials = adv.fullName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <article
                key={adv.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
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
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                      color: "#0ea5e9",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 14,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
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

                <div
                  style={{
                    display: "inline-block",
                    marginBottom: 10,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {professionalTypeLabel(adv.advisorProfile?.professionalType)}
                </div>

                {adv.advisorProfile?.bio && (
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: 12,
                      color: "var(--text)",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {adv.advisorProfile.bio}
                  </p>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                    paddingTop: 12,
                    marginTop: "auto",
                    borderTop: "1px solid var(--border)",
                    fontSize: 11,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 600 }}>Posts</p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {m?.posts ?? 0}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 600 }}>Subs</p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {m?.subs ?? 0}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 600 }}>Plans</p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "#0ea5e9" }}>
                      {servicesByAdvisor.get(adv.id) ?? 0}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <Link
                    href={`/user/advisors/${adv.id}`}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "var(--surface-2)",
                      color: "var(--text)",
                      fontWeight: 700,
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
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
