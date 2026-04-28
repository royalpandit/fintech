import Link from "next/link";
import { cookies } from "next/headers";
import { FiBell } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

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

const CHANNEL_COLORS: Record<string, { bg: string; fg: string }> = {
  in_app: { bg: "#dbeafe", fg: "#1e40af" },
  push: { bg: "#f3e8ff", fg: "#7c3aed" },
  email: { bg: "#ccfbf1", fg: "#0f766e" },
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  if (!isAuthed) {
    return (
      <section>
        <div style={{ marginBottom: 20 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.5,
            }}
          >
            Notifications
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
            Stay updated on advisor sentiment, comments, and your activity
          </p>
        </div>

        <article
          style={{
            background: "#fff",
            border: "1px solid #eef0f4",
            borderRadius: 14,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12, color: "#94a3b8", display: "flex", justifyContent: "center" }}>
            <FiBell size={36} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
            Sign in to see notifications
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b" }}>
            Get alerts when advisors post sentiment, when your comments get replies, and more.
          </p>
          <Link
            href="/register"
            style={{
              display: "inline-block",
              padding: "10px 22px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #0ea5e9, #16a34a)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Get started — free
          </Link>
        </article>
      </section>
    );
  }

  const filter = searchParams.filter ?? "all";
  const where: Record<string, unknown> = { userId: userId! };
  if (filter === "unread") where.readAt = null;
  if (filter === "read") where.readAt = { not: null };

  const [notifications, unreadCount, totalCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: userId!, readAt: null } }),
    prisma.notification.count({ where: { userId: userId! } }),
  ]);

  const tabs = [
    { key: "all", label: `All (${totalCount})` },
    { key: "unread", label: `Unread (${unreadCount})` },
    { key: "read", label: `Read` },
  ];

  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 18,
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
            Notifications
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up ✓"}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/user/notifications" : `/user/notifications?filter=${t.key}`}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: filter === t.key ? "#fff" : "#64748b",
              background: filter === t.key ? "#0ea5e9" : "#fff",
              border: "1px solid #eef0f4",
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <article
        style={{
          background: "#fff",
          border: "1px solid #eef0f4",
          borderRadius: 14,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {notifications.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 48,
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            No notifications.
          </p>
        ) : (
          notifications.map((n, i) => {
            const cc = CHANNEL_COLORS[n.channel] ?? CHANNEL_COLORS.in_app;
            return (
              <div
                key={n.id}
                style={{
                  padding: "14px 18px",
                  borderBottom:
                    i === notifications.length - 1 ? "none" : "1px solid #eef0f4",
                  background: n.readAt ? "transparent" : "#f0f9ff",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                {!n.readAt && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: "#0ea5e9",
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                      {n.title}
                    </p>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        background: cc.bg,
                        color: cc.fg,
                      }}
                    >
                      {n.channel}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    whiteSpace: "nowrap",
                  }}
                >
                  {relTime(n.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </article>
    </section>
  );
}
