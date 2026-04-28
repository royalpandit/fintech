import Link from "next/link";
import { cookies } from "next/headers";
import { FiAlertTriangle, FiMessageSquare } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";

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

export default async function CommunityPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);

  const [posts, totalPosts] = await Promise.all([
    prisma.communityPost.findMany({
      where: { deletedAt: null, visibility: "public" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user: { select: { id: true, fullName: true, role: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.communityPost.count({ where: { deletedAt: null, visibility: "public" } }),
  ]);

  return (
    <section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 14,
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: -0.5,
                }}
              >
                Community
              </h1>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
                Personal finance discussions · No stock tips · Moderated
              </p>
            </div>
            <AuthGate
              isAuthenticated={isAuthed}
              promptTitle="Sign in to post"
              promptDescription="Join the community to share tips, ask questions, and connect."
            >
              <button
                type="button"
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0ea5e9, #10b981)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                + New Post
              </button>
            </AuthGate>
          </div>

          {/* Reminder banner */}
          <article
            style={{
              padding: 12,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 10,
              fontSize: 12,
              color: "#713f12",
              lineHeight: 1.5,
              marginBottom: 14,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <FiAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Stock-specific tips are not allowed in community. For market sentiment, visit{" "}
            <Link
              href="/user/markets"
              style={{ color: "#0c4a6e", fontWeight: 700, textDecoration: "underline" }}
            >
              Markets
            </Link>{" "}
            (SEBI advisors only).</span>
          </article>

          {/* Posts feed */}
          <div style={{ display: "grid", gap: 12 }}>
            {posts.length === 0 ? (
              <article
                style={{
                  background: "#fff",
                  border: "1px solid #eef0f4",
                  borderRadius: 14,
                  padding: 32,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 13,
                }}
              >
                No community posts yet — be the first.
              </article>
            ) : (
              posts.map((post) => {
                const initials = post.user.fullName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const isAdvisor = post.user.role === "advisor";
                return (
                  <article
                    key={post.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #eef0f4",
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9,
                          background: isAdvisor
                            ? "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))"
                            : "linear-gradient(135deg, #94a3b822, #64748b22)",
                          color: isAdvisor ? "#0ea5e9" : "#64748b",
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
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0f172a",
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                          }}
                        >
                          {post.user.fullName}
                          {isAdvisor && (
                            <span
                              style={{
                                padding: "1px 6px",
                                borderRadius: 999,
                                background: "#d1fae5",
                                color: "#047857",
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                              }}
                            >
                              Advisor
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {relTime(post.createdAt)}
                        </div>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: 14, color: "#0f172a", lineHeight: 1.55 }}>
                      {post.content}
                    </p>

                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px solid #f1f5f9",
                        display: "flex",
                        gap: 16,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <FiMessageSquare size={12} /> {post._count.comments} comments
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <aside style={{ display: "grid", gap: 14, position: "sticky", top: 80 }}>
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              Community Stats
            </h3>
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "#64748b" }}>Total Posts</span>
                <strong>{totalPosts.toLocaleString()}</strong>
              </div>
            </div>
          </article>

          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 16,
            }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              Community Rules
            </h3>
            <ul
              style={{
                margin: 0,
                padding: "0 0 0 18px",
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.7,
              }}
            >
              <li>Be respectful</li>
              <li>No stock tips or buy/sell advice</li>
              <li>No promotional spam</li>
              <li>No personal financial details</li>
              <li>Use hashtags for discoverability</li>
            </ul>
          </article>
        </aside>
      </div>
    </section>
  );
}
