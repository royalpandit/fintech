import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FiMessageCircle } from "react-icons/fi";
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

  const threads = await prisma.dmThread.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    include: {
      participants: { include: { user: { select: { id: true, fullName: true } } } },
      messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title">Messages</h1>
        <p className="page-subtitle">Conversations with your subscribers.</p>
      </div>

      {threads.length === 0 ? (
        <article className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, color: "var(--text-muted)" }}>
            <FiMessageCircle size={40} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
            No messages yet
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            When a subscriber messages you, the conversation will appear here.
          </p>
        </article>
      ) : (
        <article className="card" style={{ padding: 0, overflow: "hidden" }}>
          <style>{`.msg-thread-link:hover { background: var(--hover) !important; }`}</style>
          {threads.map((t, i) => {
            const partner = t.participants.find((p) => p.userId !== userId)?.user;
            const lastMsg = t.messages[0];
            return (
              <Link
                key={t.id}
                href={`/advisor/messages/${t.id}`}
                className="msg-thread-link"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 18px",
                  borderBottom: i === threads.length - 1 ? "none" : "1px solid var(--border)",
                  textDecoration: "none",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                    color: "#0ea5e9",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(partner?.fullName ?? "??")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}>
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
        </article>
      )}
    </section>
  );
}
