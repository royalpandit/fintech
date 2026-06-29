"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiMessageCircle, FiSearch } from "react-icons/fi";
import { isChatActive } from "@/lib/subscription-plans";

export type ThreadRow = {
  id: number;
  partnerName: string;
  lastPreview: string;
  lastAt: string | null;
  isOwnLast: boolean;
};

export type SubscriptionRow = {
  id: number;
  status: string;
  amount: number;
  startDate: string;
  endDate: string | null;
  advisor: {
    id: number;
    fullName: string;
    sebiRegistrationNo: string | null;
  };
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function planLabel(amount: number): string {
  if (amount === 299) return "Monthly plan";
  if (amount === 2499) return "Yearly plan";
  if (amount > 0) return `₹${amount.toLocaleString("en-IN")}`;
  return "Free follow";
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusMeta(sub: SubscriptionRow): { label: string; color: string; canChat: boolean } {
  const active = isChatActive({ status: sub.status, endDate: sub.endDate });
  if (active) return { label: "Active", color: "#16a34a", canChat: true };
  if (sub.status === "cancelled") return { label: "Cancelled", color: "#dc2626", canChat: false };
  if (sub.status === "expired" || (sub.endDate && new Date(sub.endDate) <= new Date())) {
    return { label: "Expired", color: "#64748b", canChat: false };
  }
  return { label: sub.status, color: "#64748b", canChat: false };
}

export default function MessagesInbox({
  threads,
  subscriptions,
}: {
  threads: ThreadRow[];
  subscriptions: SubscriptionRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const q = query.trim().toLowerCase();

  const filteredSubs = useMemo(() => {
    if (!q) return subscriptions;
    return subscriptions.filter((s) => {
      const hay = [
        s.advisor.fullName,
        s.advisor.sebiRegistrationNo ?? "",
        planLabel(s.amount),
        s.status,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [subscriptions, q]);

  const filteredThreads = useMemo(() => {
    if (!q) return threads;
    return threads.filter((t) => {
      const hay = `${t.partnerName} ${t.lastPreview}`.toLowerCase();
      return hay.includes(q);
    });
  }, [threads, q]);

  async function openChat(targetUserId: number) {
    if (openingId) return;
    setOpeningId(targetUserId);
    setError("");
    try {
      const res = await fetch("/api/v1/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.threadId) {
        router.push(`/user/messages/${json.threadId}`);
        return;
      }
      setError(json.error || "Couldn't open chat. Please try again.");
      setOpeningId(null);
    } catch {
      setError("Network error. Please try again.");
      setOpeningId(null);
    }
  }

  return (
    <div className="msg-inbox">
      <div className="msg-inbox-search-wrap">
        <FiSearch size={16} className="msg-inbox-search-icon" aria-hidden />
        <input
          type="search"
          className="msg-inbox-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations and subscribed analysts…"
          aria-label="Search messages"
        />
      </div>

      <section className="msg-inbox-section">
        <div className="msg-inbox-section-head">
          <h2>Your subscriptions</h2>
          <span>{filteredSubs.length}</span>
        </div>

        {subscriptions.length === 0 ? (
          <div className="msg-inbox-empty-card">
            <p>No advisor subscriptions yet. Subscribe to an analyst to unlock 1-to-1 chat.</p>
            <Link href="/user/advisors" className="msg-inbox-cta">
              Browse analysts
            </Link>
          </div>
        ) : filteredSubs.length === 0 ? (
          <p className="msg-inbox-muted">No subscriptions match &quot;{query}&quot;.</p>
        ) : (
          <div className="msg-sub-list">
            {filteredSubs.map((sub) => {
              const meta = statusMeta(sub);
              const opening = openingId === sub.advisor.id;
              return (
                <article key={sub.id} className="msg-sub-card">
                  <div className="msg-sub-card-main">
                    <div className="msg-avatar">{getInitials(sub.advisor.fullName)}</div>
                    <div className="msg-sub-card-body">
                      <div className="msg-sub-card-title">{sub.advisor.fullName}</div>
                      <div className="msg-sub-card-meta">
                        {planLabel(sub.amount)}
                        {sub.advisor.sebiRegistrationNo
                          ? ` · SEBI ${sub.advisor.sebiRegistrationNo}`
                          : ""}
                      </div>
                      <div className="msg-sub-card-dates">
                        {formatDate(sub.startDate)} → {formatDate(sub.endDate)}
                      </div>
                    </div>
                    <span className="msg-sub-status" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="msg-sub-card-actions">
                    {meta.canChat ? (
                      <button
                        type="button"
                        className="msg-sub-chat-btn"
                        onClick={() => openChat(sub.advisor.id)}
                        disabled={opening}
                      >
                        <FiMessageCircle size={14} />
                        {opening ? "Opening…" : "Message analyst"}
                      </button>
                    ) : (
                      <Link href={`/user/advisors/${sub.advisor.id}`} className="msg-sub-renew-link">
                        View analyst · renew
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="msg-inbox-section">
        <div className="msg-inbox-section-head">
          <h2>Conversations</h2>
          <span>{filteredThreads.length}</span>
        </div>

        {threads.length === 0 ? (
          <div className="msg-inbox-empty-card">
            <FiMessageCircle size={36} style={{ marginBottom: 10, opacity: 0.45 }} />
            <p>No conversations yet. Message an analyst from your subscriptions above.</p>
          </div>
        ) : filteredThreads.length === 0 ? (
          <p className="msg-inbox-muted">No conversations match &quot;{query}&quot;.</p>
        ) : (
          <article className="msg-thread-list">
            {filteredThreads.map((t) => (
              <Link key={t.id} href={`/user/messages/${t.id}`} className="msg-thread-link">
                <div className="msg-avatar">{getInitials(t.partnerName)}</div>
                <div className="msg-thread-body">
                  <div className="msg-thread-name">{t.partnerName}</div>
                  <div className="msg-thread-preview">
                    {t.isOwnLast ? `You: ${t.lastPreview}` : t.lastPreview}
                  </div>
                </div>
                {t.lastAt && <span className="msg-thread-time">{relTime(t.lastAt)}</span>}
              </Link>
            ))}
          </article>
        )}
      </section>

      {error && <p className="msg-inbox-error">{error}</p>}
    </div>
  );
}
