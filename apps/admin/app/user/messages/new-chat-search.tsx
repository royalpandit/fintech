"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch, FiMessageCircle } from "react-icons/fi";

type Contact = { id: number; fullName: string };

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function NewChatSearch({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.fullName.toLowerCase().includes(q));
  }, [contacts, query]);

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
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
        New message
      </h2>

      {contacts.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          You can message advisors you&apos;re subscribed to. Subscribe to an advisor to start a chat.
        </p>
      ) : (
        <>
          <div style={{ position: "relative", marginBottom: results.length ? 12 : 0 }}>
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
              placeholder="Search advisors you've subscribed to…"
              style={{
                width: "100%",
                height: 44,
                padding: "0 14px 0 40px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {results.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              No subscribed advisors match &quot;{query}&quot;.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openChat(c.id)}
                  disabled={openingId === c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "inherit",
                    cursor: openingId === c.id ? "wait" : "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                      color: "#0ea5e9",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(c.fullName)}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    {c.fullName}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#0ea5e9",
                    }}
                  >
                    <FiMessageCircle size={14} />
                    {openingId === c.id ? "Opening…" : "Chat"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#dc2626" }}>{error}</p>
      )}
    </article>
  );
}
