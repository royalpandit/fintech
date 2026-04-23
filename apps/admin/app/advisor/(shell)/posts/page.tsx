import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function complianceColor(status: string) {
  if (status === "approved") return "#10b981";
  if (status === "flagged" || status === "rejected") return "#ef4444";
  return "#f59e0b";
}

type SearchParams = { status?: string };

export default async function AdvisorPostsPage({ searchParams }: { searchParams: SearchParams }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");
  const userId = auth.userId;

  const status = searchParams.status;
  const valid = status && ["pending", "under_review", "approved", "flagged", "rejected"].includes(status);
  const where = {
    advisorUserId: userId,
    deletedAt: null,
    ...(valid ? { complianceStatus: status as any } : {}),
  };

  const [allCount, pendingCount, approvedCount, flaggedCount, rejectedCount, posts] = await Promise.all([
    prisma.marketPost.count({ where: { advisorUserId: userId, deletedAt: null } }),
    prisma.marketPost.count({
      where: {
        advisorUserId: userId,
        deletedAt: null,
        complianceStatus: { in: ["pending", "under_review"] },
      },
    }),
    prisma.marketPost.count({
      where: { advisorUserId: userId, deletedAt: null, complianceStatus: "approved" },
    }),
    prisma.marketPost.count({
      where: { advisorUserId: userId, deletedAt: null, complianceStatus: "flagged" },
    }),
    prisma.marketPost.count({
      where: { advisorUserId: userId, deletedAt: null, complianceStatus: "rejected" },
    }),
    prisma.marketPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { comments: true, reactions: true } } },
    }),
  ]);

  const tabs = [
    { key: "", label: `All (${allCount})`, href: "/advisor/posts" },
    { key: "pending", label: `Pending (${pendingCount})`, href: "/advisor/posts?status=pending" },
    { key: "approved", label: `Published (${approvedCount})`, href: "/advisor/posts?status=approved" },
    { key: "flagged", label: `Flagged (${flaggedCount})`, href: "/advisor/posts?status=flagged" },
    { key: "rejected", label: `Rejected (${rejectedCount})`, href: "/advisor/posts?status=rejected" },
  ];

  const activeKey = status || "";

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
        <div>
          <h1 className="page-title">My Market Posts</h1>
          <p className="page-subtitle">Draft, track, and manage every sentiment post you publish.</p>
        </div>
        <Link href="/advisor/posts/new" className="btn-primary" style={{ padding: "12px 20px" }}>
          + New Post
        </Link>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <Link
            key={tab.key || "all"}
            href={tab.href}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: activeKey === tab.key ? "#047857" : "#fff",
              color: activeKey === tab.key ? "#fff" : "var(--text)",
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Symbol</th>
                <th>Sentiment</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Engagement</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#61708b" }}>
                    No posts in this bucket.{" "}
                    <Link href="/advisor/posts/new" style={{ color: "#047857", fontWeight: 600 }}>
                      Create one →
                    </Link>
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id}>
                    <td style={{ maxWidth: 380 }}>
                      <Link
                        href={`/advisor/posts/${post.id}`}
                        style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}
                      >
                        {post.title}
                      </Link>
                    </td>
                    <td>{post.marketSymbol ?? "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{post.sentiment}</td>
                    <td style={{ textTransform: "capitalize" }}>{post.riskLevel}</td>
                    <td>
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: `${complianceColor(post.complianceStatus)}22`,
                          color: complianceColor(post.complianceStatus),
                        }}
                      >
                        {post.complianceStatus}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {post._count.reactions} ❤ · {post._count.comments} 💬
                    </td>
                    <td>{post.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
