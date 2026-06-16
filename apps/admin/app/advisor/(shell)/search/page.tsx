import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

export default async function AdvisorSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");
  const userId = auth.userId;

  const q = (searchParams.q ?? "").trim();

  const [posts, subs, courses] = q
    ? await Promise.all([
        prisma.marketPost.findMany({
          where: {
            advisorUserId: userId,
            deletedAt: null,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { marketSymbol: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, title: true, marketSymbol: true, sentiment: true },
        }),
        prisma.subscription.findMany({
          where: {
            advisorUserId: userId,
            user: {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { user: { select: { id: true, fullName: true, email: true } } },
        }),
        prisma.course.findMany({
          where: {
            advisorUserId: userId,
            deletedAt: null,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, title: true, description: true },
        }),
      ])
    : [[], [], []];

  const total = posts.length + subs.length + courses.length;

  return (
    <section>
      <h1 className="page-title">Search</h1>
      <p className="page-subtitle">
        {q ? (
          <>
            {total} result{total === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
          </>
        ) : (
          "Type a query in the search bar to find your posts, subscribers, and courses."
        )}
      </p>

      {q && total === 0 && (
        <article className="card" style={{ marginTop: 16 }}>
          <p
            className="page-subtitle"
            style={{ margin: 0, textAlign: "center", padding: 32 }}
          >
            No posts, subscribers, or courses match &ldquo;{q}&rdquo;.
          </p>
        </article>
      )}

      {posts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>
            Posts ({posts.length})
          </h2>
          <div style={cardStyle}>
            {posts.map((p, i) => (
              <Link
                key={p.id}
                href={`/advisor/posts/${p.id}`}
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

      {subs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>
            Subscribers ({subs.length})
          </h2>
          <div style={cardStyle}>
            {subs.map((s, i) => (
              <Link
                key={s.id}
                href="/advisor/subscribers"
                style={{ ...rowStyle, borderBottom: i === subs.length - 1 ? "none" : rowStyle.borderBottom }}
              >
                <span style={{ fontWeight: 600 }}>{s.user?.fullName ?? "—"}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  {s.user?.email ?? ""}
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
                href={`/advisor/courses/${c.id}`}
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
