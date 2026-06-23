import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FiMessageCircle, FiSearch } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AdvisorMessagesPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");
  const userId = auth.userId;

  const [threads, subscribers, activeCount, expiredCount, cancelledCount] = await Promise.all([
    prisma.dmThread.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true } } } },
        messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.subscription.findMany({
      where: { advisorUserId: userId, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, fullName: true, email: true, createdAt: true } },
      },
    }),
    prisma.subscription.count({ where: { advisorUserId: userId, status: "active" } }),
    prisma.subscription.count({ where: { advisorUserId: userId, status: "expired" } }),
    prisma.subscription.count({ where: { advisorUserId: userId, status: "cancelled" } }),
  ]);

  // Build a map of subscriber userId → existing thread id (if any)
  const threadByUser = new Map<number, number>();
  for (const t of threads) {
    const partner = t.participants.find((p) => p.userId !== userId);
    if (partner) threadByUser.set(partner.userId, t.id);
  }

  return (
    <section>
      {/* Stats row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>Messages</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Manage conversations with your subscribers.</p>
        </div>
        <Link href="/advisor/subscribers" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
          View full subscriber report →
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <article className="card" style={{ padding: "14px 16px" }}>
          <p className="metric-label">Active Subscribers</p>
          <p className="metric-value" style={{ fontSize: 28, marginTop: 4 }}>{activeCount.toLocaleString()}</p>
        </article>
        <article className="card" style={{ padding: "14px 16px" }}>
          <p className="metric-label">Conversations</p>
          <p className="metric-value" style={{ fontSize: 28, marginTop: 4 }}>{threads.length.toLocaleString()}</p>
        </article>
        <article className="card" style={{ padding: "14px 16px" }}>
          <p className="metric-label">Expired</p>
          <p className="metric-value" style={{ fontSize: 28, marginTop: 4, color: "#f59e0b" }}>{expiredCount.toLocaleString()}</p>
        </article>
        <article className="card" style={{ padding: "14px 16px" }}>
          <p className="metric-label">Cancelled</p>
          <p className="metric-value" style={{ fontSize: 28, marginTop: 4, color: "#ef4444" }}>{cancelledCount.toLocaleString()}</p>
        </article>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* LEFT — Full subscriber list */}
        <article className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                Your Subscribers
              </span>
              <span
                style={{
                  marginLeft: 8,
                  padding: "1px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "#d1fae5",
                  color: "#047857",
                }}
              >
                {activeCount} active
              </span>
            </div>
          </div>

          {subscribers.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                No active subscribers yet. Once users subscribe to your profile, they'll appear here.
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: 540, overflowY: "auto" }}>
              {subscribers.map((sub, i) => {
                const u = sub.user;
                if (!u) return null;
                const threadId = threadByUser.get(u.id);
                const initials = getInitials(u.fullName);
                return (
                  <div
                    key={sub.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom: i === subscribers.length - 1 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(16,185,129,0.12))",
                        color: "#0ea5e9",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                        {u.fullName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {u.email}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span
                        style={{
                          padding: "1px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 600,
                          background: "#d1fae5",
                          color: "#047857",
                        }}
                      >
                        active
                      </span>
                      {threadId ? (
                        <Link
                          href={`/advisor/messages/${threadId}`}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#0ea5e9",
                            textDecoration: "none",
                          }}
                        >
                          View chat →
                        </Link>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No chat yet</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        {/* RIGHT — Recent conversations */}
        <article className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              fontWeight: 700,
              fontSize: 14,
              color: "var(--text)",
            }}
          >
            Recent Conversations
            {threads.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "1px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "rgba(14,165,233,0.12)",
                  color: "#0284c7",
                }}
              >
                {threads.length}
              </span>
            )}
          </div>

          {threads.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <FiMessageCircle size={32} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                No conversations yet. When a subscriber messages you, it will appear here.
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: 540, overflowY: "auto" }}>
              {threads.map((t, i) => {
                const partner = t.participants.find((p) => p.userId !== userId)?.user;
                const lastMsg = t.messages[0];
                return (
                  <Link
                    key={t.id}
                    href={`/advisor/messages/${t.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom: i === threads.length - 1 ? "none" : "1px solid var(--border)",
                      textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                        color: "#0ea5e9",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(partner?.fullName ?? "??")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                        {partner?.fullName ?? "Unknown"}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lastMsg
                          ? lastMsg.senderUserId === userId
                            ? `You: ${lastMsg.contentEnc}`
                            : lastMsg.contentEnc
                          : "No messages yet"}
                      </div>
                    </div>
                    {lastMsg && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                        {relTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
