"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notificationHref } from "@/lib/notification-href";

type Notification = {
  id: number;
  channel: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notifications");
      const j = await res.json();
      setItems(j.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the list current without a reload.
  useEffect(() => {
    const silent = async () => {
      try {
        const res = await fetch("/api/v1/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (Array.isArray(j.data)) setItems(j.data);
      } catch {
        // offline — retry on the next tick
      }
    };
    const id = setInterval(silent, 20_000);
    const onFocus = () => void silent();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const unreadCount = items.filter((n) => !n.readAt).length;

  async function markOne(id: number) {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  }

  async function markAll() {
    if (unreadCount === 0) return;
    setBusy(true);
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    try {
      await fetch("/api/v1/notifications/read-all", { method: "PATCH" });
    } finally {
      setBusy(false);
    }
  }

  const shown = filter === "unread" ? items.filter((n) => !n.readAt) : items;

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            Your alerts across compliance, users, and platform activity.
            {unreadCount > 0 ? ` ${unreadCount} unread.` : " You're all caught up."}
          </p>
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={busy || unreadCount === 0}
          className="btn-primary"
          style={{ opacity: unreadCount === 0 ? 0.5 : 1, whiteSpace: "nowrap" }}
        >
          Mark all read
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, margin: "16px 0" }}>
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid var(--border)",
              background: filter === f ? "var(--primary-soft)" : "var(--surface)",
              color: filter === f ? "#047857" : "var(--text-muted)",
              textTransform: "capitalize",
            }}
          >
            {f}
            {f === "unread" ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      <article className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <p style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", margin: 0 }}>
            Loading…
          </p>
        ) : shown.length === 0 ? (
          <p style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", margin: 0 }}>
            No {filter === "unread" ? "unread " : ""}notifications.
          </p>
        ) : (
          shown.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                void markOne(n.id);
                const href = notificationHref(n.data);
                if (href) router.push(href);
              }}
              style={{
                display: "flex",
                gap: 12,
                width: "100%",
                textAlign: "left",
                alignItems: "flex-start",
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                background: n.readAt ? "transparent" : "var(--primary-soft)",
                border: "none",
                borderBottomWidth: 1,
                borderBottomStyle: "solid",
                borderBottomColor: "var(--border)",
                cursor: notificationHref(n.data) ? "pointer" : "default",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  marginTop: 6,
                  flexShrink: 0,
                  background: n.readAt ? "var(--border)" : "#10b981",
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: n.readAt ? 500 : 700,
                    color: "var(--text)",
                  }}
                >
                  {n.title}
                </span>
                <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                  {n.message}
                </span>
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {relTime(n.createdAt)}
              </span>
            </button>
          ))
        )}
      </article>
    </section>
  );
}
