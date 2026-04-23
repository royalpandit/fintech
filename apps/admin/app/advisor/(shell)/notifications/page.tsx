import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import MarkAllReadButton from "./mark-all-read";

export const dynamic = "force-dynamic";

type SearchParams = { filter?: string };

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

function channelTag(channel: string) {
  const map: Record<string, { bg: string; fg: string }> = {
    in_app: { bg: "#dbeafe", fg: "#1e40af" },
    push: { bg: "#f3e8ff", fg: "#7c3aed" },
    email: { bg: "#ccfbf1", fg: "#0f766e" },
  };
  const s = map[channel] ?? map.in_app;
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
      }}
    >
      {channel}
    </span>
  );
}

export default async function AdvisorNotificationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const filter = searchParams.filter;

  const where: Record<string, unknown> = { userId: auth.userId };
  if (filter === "unread") where.readAt = null;
  else if (filter === "read") where.readAt = { not: null };

  const [notifications, unreadCount, totalCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
    prisma.notification.count({ where: { userId: auth.userId } }),
  ]);

  const current = filter || "all";
  const tabs = [
    { key: "all", label: `All (${totalCount})`, href: "/advisor/notifications" },
    { key: "unread", label: `Unread (${unreadCount})`, href: "/advisor/notifications?filter=unread" },
    { key: "read", label: "Read", href: "/advisor/notifications?filter=read" },
  ];

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notifications.`
              : "You're all caught up."}
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: current === tab.key ? "#047857" : "#fff",
              color: current === tab.key ? "#fff" : "var(--text)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <article className="card" style={{ marginTop: 16, padding: 0 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#61708b" }}>
            No notifications here.
          </div>
        ) : (
          <div>
            {notifications.map((n, i) => (
              <div
                key={n.id}
                style={{
                  padding: "16px 20px",
                  borderBottom:
                    i === notifications.length - 1 ? "none" : "1px solid var(--border)",
                  background: n.readAt ? "transparent" : "#f0fdf4",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    {!n.readAt && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: "#10b981",
                        }}
                      />
                    )}
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{n.title}</p>
                    {channelTag(n.channel)}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                </div>
                <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                  {relTime(n.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
