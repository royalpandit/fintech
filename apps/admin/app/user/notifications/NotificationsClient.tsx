"use client";

import { useState } from "react";
import Link from "next/link";
import { FiCheckCircle, FiCheck, FiUserPlus, FiUserCheck, FiX } from "react-icons/fi";

type Notification = {
  id: number;
  channel: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

const CHANNEL_COLORS: Record<string, { bg: string; fg: string }> = {
  in_app: { bg: "#dbeafe", fg: "#1e40af" },
  push: { bg: "#f3e8ff", fg: "#7c3aed" },
  email: { bg: "#ccfbf1", fg: "#0f766e" },
};

function relTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

type PendingRequest = {
  fromUserId: number;
  fromName: string;
  createdAt: string;
};

export default function NotificationsClient({
  notifications: initial,
  unreadCount: initialUnread,
  totalCount,
  filter,
  pendingRequests: initialRequests = [],
}: {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  filter: string;
  pendingRequests?: PendingRequest[];
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [markingAll, setMarkingAll] = useState(false);
  const [requests, setRequests] = useState<PendingRequest[]>(initialRequests);
  const [requestLoading, setRequestLoading] = useState<number | null>(null);

  async function markOne(id: number) {
    const n = notifications.find((x) => x.id === id);
    if (!n || n.readAt) return;

    setNotifications((prev) =>
      prev.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
  }

  async function markAll() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnreadCount(0);
    try {
      await fetch("/api/v1/notifications/read-all", { method: "PATCH" });
    } finally {
      setMarkingAll(false);
    }
  }

  async function acceptRequest(fromUserId: number) {
    setRequestLoading(fromUserId);
    try {
      const res = await fetch(`/api/v1/friend-requests/${fromUserId}/accept`, { method: "POST" });
      if (res.ok) setRequests((prev) => prev.filter((r) => r.fromUserId !== fromUserId));
    } finally {
      setRequestLoading(null);
    }
  }

  async function declineRequest(fromUserId: number) {
    setRequestLoading(fromUserId);
    try {
      const res = await fetch(`/api/v1/users/${fromUserId}/friend-request`, { method: "DELETE" });
      if (res.ok) setRequests((prev) => prev.filter((r) => r.fromUserId !== fromUserId));
    } finally {
      setRequestLoading(null);
    }
  }

  const tabs = [
    { key: "all", label: `All (${totalCount})` },
    { key: "unread", label: `Unread (${unreadCount})` },
    { key: "read", label: "Read" },
  ];

  // Filter client-side to match server filter
  const visible =
    filter === "unread"
      ? notifications.filter((n) => !n.readAt)
      : filter === "read"
        ? notifications.filter((n) => !!n.readAt)
        : notifications;

  return (
    <>
      {/* Connection requests inbox */}
      {requests.length > 0 && (
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FiUserPlus size={14} style={{ color: "#0ea5e9" }} />
            Connection requests
            <span
              style={{
                padding: "1px 7px",
                borderRadius: 999,
                background: "#0ea5e9",
                color: "#fff",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {requests.length}
            </span>
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            {requests.map((r) => (
              <div
                key={r.fromUserId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "var(--surface-2)",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    background:
                      "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                    color: "#0ea5e9",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {r.fromName
                    .trim()
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    {r.fromName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>wants to connect with you</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => acceptRequest(r.fromUserId)}
                    disabled={requestLoading === r.fromUserId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "linear-gradient(135deg,#0ea5e9,#10b981)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: requestLoading === r.fromUserId ? "wait" : "pointer",
                    }}
                  >
                    <FiUserCheck size={12} /> Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => declineRequest(r.fromUserId)}
                    disabled={requestLoading === r.fromUserId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-muted)",
                      fontSize: 12,
                      cursor: requestLoading === r.fromUserId ? "wait" : "pointer",
                    }}
                  >
                    <FiX size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

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
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: -0.5,
            }}
          >
            Notifications
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAll}
            disabled={markingAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 12,
              fontWeight: 600,
              cursor: markingAll ? "wait" : "pointer",
            }}
          >
            <FiCheckCircle size={13} />
            Mark all read
          </button>
        )}
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
              color: filter === t.key ? "#fff" : "var(--text-muted)",
              background: filter === t.key ? "#0ea5e9" : "var(--surface)",
              border: "1px solid var(--border)",
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <article
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {visible.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 48,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No notifications.
          </p>
        ) : (
          visible.map((n, i) => {
            const cc = CHANNEL_COLORS[n.channel] ?? CHANNEL_COLORS.in_app;
            return (
              <div
                key={n.id}
                style={{
                  padding: "14px 18px",
                  borderBottom: i === visible.length - 1 ? "none" : "1px solid var(--border)",
                  background: n.readAt ? "transparent" : "var(--primary-soft)",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  transition: "background 0.2s",
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
                {n.readAt && <span style={{ width: 8, flexShrink: 0 }} />}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--text)",
                      }}
                    >
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
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--text)",
                      lineHeight: 1.5,
                    }}
                  >
                    {n.message}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {relTime(n.createdAt)}
                  </span>
                  {!n.readAt && (
                    <button
                      type="button"
                      onClick={() => markOne(n.id)}
                      title="Mark as read"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0ea5e9",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      <FiCheck size={11} /> Mark read
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </article>
    </>
  );
}
