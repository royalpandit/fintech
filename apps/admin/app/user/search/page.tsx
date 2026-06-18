import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string };

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  overflow: "hidden",
} as const;

const rowStyle = {
  display: "block",
  padding: "12px 16px",
  borderBottom: "1px solid var(--border)",
  textDecoration: "none",
  color: "var(--text)",
} as const;

export default async function UserSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = cookies().get("access_token")?.value ?? null;
  await requireAuthToken(token); // optional — guests may also search

  const q = (searchParams.q ?? "").trim();

  const [advisors, courses, posts] = q
    ? await Promise.all([
        prisma.user.findMany({
          where: {
            role: "advisor",
            deletedAt: null,
            advisorProfile: { verificationStatus: "approved" },
            fullName: { contains: q, mode: "insensitive" },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            fullName: true,
            advisorProfile: { select: { sebiRegistrationNo: true, experienceYears: true } },
          },
        }),
        prisma.course.findMany({
          where: {
            isPublished: true,
            deletedAt: null,
            complianceStatus: "approved",
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, title: true },
        }),
        prisma.marketPost.findMany({
          where: {
            complianceStatus: "approved",
            deletedAt: null,
            OR: [
              { marketSymbol: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, title: true, marketSymbol: true, sentiment: true },
        }),
      ])
    : [[], [], []];

  const total = advisors.length + courses.length + posts.length;

  return (
    <section>
      <h1 className="page-title">Search</h1>
      <p className="page-subtitle">
        {q ? (
          <>
            {total} result{total === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
          </>
        ) : (
          "Search advisors, symbols, and courses from the search bar."
        )}
      </p>

      {q && total === 0 && (
        <article className="card" style={{ marginTop: 16 }}>
          <p
            className="page-subtitle"
            style={{ margin: 0, textAlign: "center", padding: 32 }}
          >
            No advisors, symbols, or courses match &ldquo;{q}&rdquo;.
          </p>
        </article>
      )}

      {advisors.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>
            Advisors ({advisors.length})
          </h2>
          <div style={cardStyle}>
            {advisors.map((a, i) => (
              <Link
                key={a.id}
                href={`/user/advisors/${a.id}`}
                style={{ ...rowStyle, borderBottom: i === advisors.length - 1 ? "none" : rowStyle.borderBottom }}
              >
                <span style={{ fontWeight: 600 }}>{a.fullName}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  {a.advisorProfile?.sebiRegistrationNo ?? ""}
                  {a.advisorProfile?.experienceYears ? ` · ${a.advisorProfile.experienceYears}y` : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>
            Symbols &amp; posts ({posts.length})
          </h2>
          <div style={cardStyle}>
            {posts.map((p, i) => (
              <Link
                key={p.id}
                href={`/user/markets/${p.id}`}
                style={{ ...rowStyle, borderBottom: i === posts.length - 1 ? "none" : rowStyle.borderBottom }}
              >
                <span style={{ fontWeight: 600 }}>{p.title}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  {p.marketSymbol ?? ""} · {p.sentiment}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {courses.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>
            Courses ({courses.length})
          </h2>
          <div style={cardStyle}>
            {courses.map((c, i) => (
              <Link
                key={c.id}
                href={`/user/courses/${c.id}`}
                style={{ ...rowStyle, borderBottom: i === courses.length - 1 ? "none" : rowStyle.borderBottom }}
              >
                <span style={{ fontWeight: 600 }}>{c.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
