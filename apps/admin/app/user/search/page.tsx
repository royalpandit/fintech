import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { searchSymbol } from "@/lib/angelone";
import {
  SEARCH_CATEGORY_LABELS,
  SEARCH_CATEGORY_ORDER,
  TRENDING_STOCKS,
  chartHref,
  groupMarketHits,
  normalizeMarketSearchRow,
} from "@/lib/search-categories";

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
  await requireAuthToken(token);

  const q = (searchParams.q ?? "").trim();

  const [advisors, courses, marketRows] = q
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
        searchSymbol("ALL", q).catch(() => []),
      ])
    : [[], [], []];

  const marketHits = (q ? marketRows : TRENDING_STOCKS).map(normalizeMarketSearchRow);
  const grouped = groupMarketHits(marketHits);
  const marketTotal = marketHits.length;
  const peopleTotal = advisors.length + courses.length;
  const total = marketTotal + peopleTotal;

  return (
    <section>
      <h1 className="page-title">Search</h1>
      <p className="page-subtitle">
        {q ? (
          <>
            {total} result{total === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
          </>
        ) : (
          "Trending stocks — type to search across stocks, mutual funds, options, and futures."
        )}
      </p>

      {q && total === 0 && (
        <article className="card" style={{ marginTop: 16 }}>
          <p className="page-subtitle" style={{ margin: 0, textAlign: "center", padding: 32 }}>
            No results match &ldquo;{q}&rdquo;.
          </p>
        </article>
      )}

      {(marketTotal > 0 || !q) && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>
            {q ? "Markets" : "Trending Stocks"} ({marketTotal})
          </h2>

          {SEARCH_CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat];
            if (!items.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 16 }}>
                <h3
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    margin: "0 0 8px",
                  }}
                >
                  {SEARCH_CATEGORY_LABELS[cat]} ({items.length})
                </h3>
                <div style={cardStyle}>
                  {items.map((hit, i) => (
                    <Link
                      key={`${hit.exchange}-${hit.token}`}
                      href={chartHref(hit)}
                      style={{
                        ...rowStyle,
                        borderBottom:
                          i === items.length - 1 ? "none" : rowStyle.borderBottom,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{hit.display}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>
                        {hit.tradingSymbol} · {hit.exchange}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
                style={{
                  ...rowStyle,
                  borderBottom: i === advisors.length - 1 ? "none" : rowStyle.borderBottom,
                }}
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
                style={{
                  ...rowStyle,
                  borderBottom: i === courses.length - 1 ? "none" : rowStyle.borderBottom,
                }}
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
