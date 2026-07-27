"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiSearch } from "react-icons/fi";

export type ThreadItem = {
  id: number;
  partnerName: string;
  preview: string;
  timeLabel: string;
};

type SearchHit = {
  threadId: number;
  partnerName: string;
  snippet: string;
  createdAt: string | null;
  matchedIn: "message" | "name";
};

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ThreadList({ threads }: { threads: ThreadItem[] }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Instant local filter over the loaded conversations (name + last message).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.partnerName.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q),
    );
  }, [threads, query]);

  // Deep search across full message history (server-side), debounced.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/messages/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!cancelled) setHits(res.ok ? (json.data ?? []) : []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Message-body hits that the local filter didn't already surface.
  const localIds = new Set(filtered.map((t) => t.id));
  const deepHits = hits.filter((h) => h.matchedIn === "message" && !localIds.has(h.threadId));

  return (
    <>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <FiSearch
          size={16}
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts or messages…"
          style={{
            width: "100%",
            height: 44,
            padding: "0 14px 0 40px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <article
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <style>{`.msg-thread-link:hover { background: var(--hover) !important; }`}</style>

        {filtered.length === 0 && deepHits.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 32,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            {searching ? "Searching…" : `No conversations match "${query}".`}
          </p>
        ) : (
          filtered.map((t, i) => (
            <Link
              key={t.id}
              href={`/user/messages/${t.id}`}
              className="msg-thread-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                borderBottom: i === filtered.length - 1 ? "none" : "1px solid var(--border)",
                textDecoration: "none",
                transition: "background 0.15s",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background:
                    "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                  color: "#0ea5e9",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {getInitials(t.partnerName)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: 3,
                  }}
                >
                  {t.partnerName}
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
                  {t.preview}
                </div>
              </div>

              {t.timeLabel && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                  {t.timeLabel}
                </span>
              )}
            </Link>
          ))
        )}
      </article>

      {/* Matches found deeper in message history (older than the last message). */}
      {deepHits.length > 0 && (
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            overflow: "hidden",
            marginTop: 12,
          }}
        >
          <div
            style={{
              padding: "10px 18px",
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              color: "var(--text-muted)",
            }}
          >
            In messages
          </div>
          {deepHits.map((h, i) => (
            <Link
              key={`${h.threadId}-${i}`}
              href={`/user/messages/${h.threadId}`}
              className="msg-thread-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                borderBottom: i === deepHits.length - 1 ? "none" : "1px solid var(--border)",
                textDecoration: "none",
                transition: "background 0.15s",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background:
                    "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                  color: "#0ea5e9",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {getInitials(h.partnerName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 3 }}
                >
                  {h.partnerName}
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
                  {h.snippet}
                </div>
              </div>
              {h.createdAt && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                  {relTime(h.createdAt)}
                </span>
              )}
            </Link>
          ))}
        </article>
      )}
    </>
  );
}
