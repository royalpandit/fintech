"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FiCheck } from "react-icons/fi";
import { notificationHref, type NotificationData } from "@/lib/notification-href";

export type FeedNotification = {
  id: number;
  channel: string;
  title: string;
  message: string;
  data?: NotificationData;
  readAt: string | null;
  createdAt: string;
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

/**
 * Notification list shared by the advisor and super-admin pages: rows link
 * through to whatever they're about, mark themselves read on click, and the
 * list polls so new arrivals don't need a page reload.
 */
export default function NotificationFeed({
  initial,
  audience,
  accent = "#10b981",
  filter = "all",
  emptyLabel = "No notifications here.",
}: {
  initial: FeedNotification[];
  audience: "user" | "advisor";
  accent?: string;
  filter?: "all" | "unread" | "read";
  emptyLabel?: string;
}) {
  const [items, setItems] = useState<FeedNotification[]>(initial);

  useEffect(() => setItems(initial), [initial]);

  const endpoint = audience === "advisor" ? "/api/v1/advisor/notifications" : "/api/v1/notifications";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.data)) setItems(json.data as FeedNotification[]);
    } catch {
      // offline — try again on the next tick
    }
  }, [endpoint]);

  useEffect(() => {
    const id = setInterval(refresh, 20_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function markOne(id: number) {
    const n = items.find((x) => x.id === id);
    if (!n || n.readAt) return;
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x)),
    );
    try {
      await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      /* the next poll will reconcile */
    }
  }

  const visible =
    filter === "unread"
      ? items.filter((n) => !n.readAt)
      : filter === "read"
        ? items.filter((n) => !!n.readAt)
        : items;

  if (visible.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div>
      {visible.map((n, i) => {
        const href = notificationHref(n.data, audience);
        const RowTag = (href ? Link : "div") as React.ElementType;
        return (
          <RowTag
            key={n.id}
            {...(href ? { href, onClick: () => void markOne(n.id) } : {})}
            className={href ? "notif-row notif-row-link" : "notif-row"}
            style={{
              padding: "16px 20px",
              borderBottom: i === visible.length - 1 ? "none" : "1px solid var(--border)",
              background: n.readAt ? "transparent" : "var(--primary-soft)",
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                {!n.readAt && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: accent,
                      flexShrink: 0,
                    }}
                  />
                )}
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
                  {n.title}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
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
              <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {relTime(n.createdAt)}
              </span>
              {!n.readAt && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void markOne(n.id);
                  }}
                  title="Mark as read"
                  style={{
                    background: "none",
                    border: "none",
                    color: accent,
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
          </RowTag>
        );
      })}
    </div>
  );
}
