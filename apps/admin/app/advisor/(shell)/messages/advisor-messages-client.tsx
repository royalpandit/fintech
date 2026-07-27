"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FiMessageCircle, FiSearch, FiRadio } from "react-icons/fi";
import BroadcastComposer from "./broadcast-composer";

export type AdvisorThread = {
  id: number;
  partnerName: string;
  preview: string;
  timeLabel: string;
  serviceNames: string[];
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdvisorMessagesClient({
  threads,
  services,
}: {
  threads: AdvisorThread[];
  services: { id: number; name: string; count: number }[];
}) {
  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string | null>(null); // service name or null = All
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (serviceFilter && !t.serviceNames.includes(serviceFilter)) return false;
      if (q && !(t.partnerName.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [threads, query, serviceFilter]);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-subtitle">Chat with your subscribers, or broadcast to all of them.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}
          onClick={() => setBroadcastOpen(true)}
        >
          <FiRadio size={15} /> Broadcast
        </button>
      </div>

      {/* Subscriber search */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <FiSearch
          size={16}
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subscribers or messages…"
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

      {/* Subscription filters (dynamic from the analyst's services) */}
      {services.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setServiceFilter(null)}
            className={`bc-recip-chip${serviceFilter === null ? " active" : ""}`}
            style={{ flexShrink: 0 }}
          >
            All ({threads.length})
          </button>
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceFilter((f) => (f === s.name ? null : s.name))}
              className={`bc-recip-chip${serviceFilter === s.name ? " active" : ""}`}
              style={{ flexShrink: 0 }}
            >
              {s.name} ({s.count})
            </button>
          ))}
        </div>
      )}

      {threads.length === 0 ? (
        <article className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, color: "var(--text-muted)" }}>
            <FiMessageCircle size={40} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>No messages yet</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            When a subscriber messages you — or you broadcast — the conversation appears here.
          </p>
        </article>
      ) : filtered.length === 0 ? (
        <article className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          No conversations match &quot;{query}&quot;.
        </article>
      ) : (
        <article className="card" style={{ padding: 0, overflow: "hidden" }}>
          <style>{`.msg-thread-link:hover { background: var(--hover) !important; }`}</style>
          {filtered.map((t, i) => (
            <Link
              key={t.id}
              href={`/advisor/messages/${t.id}`}
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
                  background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
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
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t.partnerName}</span>
                  {t.serviceNames.slice(0, 3).map((sn) => (
                    <span
                      key={sn}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "#0ea5e9",
                        background: "rgba(14,165,233,0.12)",
                        padding: "1px 7px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sn}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.preview}
                </div>
              </div>
              {t.timeLabel && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{t.timeLabel}</span>
              )}
            </Link>
          ))}
        </article>
      )}

      {broadcastOpen && <BroadcastComposer onClose={() => setBroadcastOpen(false)} />}
    </section>
  );
}
