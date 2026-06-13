"use client";

import { useEffect, useState } from "react";

type Sub = { user: { id: number; fullName: string; email: string } };

/**
 * Lets the advisor pick specific subscribers to send a post to (audience="custom").
 * Fetches their active subscribers and returns the selected user ids via onChange.
 */
export default function RecipientPicker({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/advisor/subscribers?status=active&limit=100", {
          cache: "no-store",
        });
        const data = await res.json();
        setSubs(Array.isArray(data.data) ? data.data : []);
      } catch {
        // ignore — empty list handled below
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const filtered = subs.filter(
    (s) =>
      s.user.fullName.toLowerCase().includes(q.toLowerCase()) ||
      s.user.email.toLowerCase().includes(q.toLowerCase()),
  );

  if (loading) return <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Loading subscribers…</p>;
  if (subs.length === 0)
    return (
      <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
        You don&apos;t have any subscribers yet to send to.
      </p>
    );

  return (
    <div>
      <input
        className="input"
        placeholder="Search subscribers…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <div
        style={{
          maxHeight: 220,
          overflowY: "auto",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}
      >
        {filtered.map((s) => (
          <label
            key={s.user.id}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: "9px 12px",
              borderBottom: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(s.user.id)}
              onChange={() => toggle(s.user.id)}
            />
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{s.user.fullName}</span>
            <span style={{ color: "#94a3b8", fontSize: 11 }}>{s.user.email}</span>
          </label>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "#64748b", margin: "6px 0 0" }}>
        {selected.length} selected
      </p>
    </div>
  );
}
