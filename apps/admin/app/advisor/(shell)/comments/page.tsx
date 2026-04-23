import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import HideCommentButton from "./hide-comment";

export const dynamic = "force-dynamic";

type SearchParams = { filter?: string };

export default async function AdvisorCommentsPage({ searchParams }: { searchParams: SearchParams }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const filter = searchParams.filter ?? "all";
  const where: Record<string, unknown> = {
    deletedAt: null,
    post: { advisorUserId: auth.userId, deletedAt: null },
  };
  if (filter === "toxic") where.toxicityScore = { gte: 5 };
  else if (filter === "flagged") where.toxicityScore = { gte: 7 };

  const [comments, totalAll, toxicCount, flaggedCount] = await Promise.all([
    prisma.marketComment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { fullName: true, email: true } },
        post: { select: { id: true, title: true } },
      },
    }),
    prisma.marketComment.count({
      where: { deletedAt: null, post: { advisorUserId: auth.userId, deletedAt: null } },
    }),
    prisma.marketComment.count({
      where: {
        deletedAt: null,
        post: { advisorUserId: auth.userId, deletedAt: null },
        toxicityScore: { gte: 5 },
      },
    }),
    prisma.marketComment.count({
      where: {
        deletedAt: null,
        post: { advisorUserId: auth.userId, deletedAt: null },
        toxicityScore: { gte: 7 },
      },
    }),
  ]);

  const tabs = [
    { key: "all", label: `All (${totalAll})` },
    { key: "toxic", label: `Toxic (${toxicCount})` },
    { key: "flagged", label: `Flagged (${flaggedCount})` },
  ];

  return (
    <section>
      <h1 className="page-title">Comments on My Posts</h1>
      <p className="page-subtitle">
        Monitor reader conversations. Hide anything toxic or off-topic.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/advisor/comments" : `/advisor/comments?filter=${tab.key}`}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: filter === tab.key ? "#047857" : "#fff",
              color: filter === tab.key ? "#fff" : "var(--text)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        {comments.length === 0 ? (
          <p
            className="page-subtitle"
            style={{ margin: 0, textAlign: "center", padding: 32 }}
          >
            No comments in this bucket.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {comments.map((c) => {
              const toxicity = c.toxicityScore ? Number(c.toxicityScore) : 0;
              const toxicityColor =
                toxicity >= 7 ? "#dc2626" : toxicity >= 5 ? "#f59e0b" : "#64748b";

              return (
                <div
                  key={c.id}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: `1px solid ${toxicity >= 5 ? "#fecaca" : "var(--border)"}`,
                    background: toxicity >= 7 ? "#fef2f2" : "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 14 }}>{c.user.fullName}</strong>
                      <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>
                        on{" "}
                        <Link
                          href={`/advisor/posts/${c.post.id}`}
                          style={{ color: "#2563eb", fontWeight: 600 }}
                        >
                          {c.post.title}
                        </Link>
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {toxicity > 0 && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${toxicityColor}22`,
                            color: toxicityColor,
                          }}
                        >
                          toxicity {toxicity.toFixed(1)}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {c.createdAt.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, marginBottom: 10, fontSize: 14 }}>{c.content}</p>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <HideCommentButton commentId={c.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
