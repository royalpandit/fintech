"use client";

import { useEffect, useRef, useState } from "react";

type Row = { rank: number; userId: number; name: string; score: number; level: string; won: number };
type Period = "all" | "weekly" | "monthly";

const PERIODS: { id: Period; label: string }[] = [
  { id: "all", label: "All-Time" },
  { id: "weekly", label: "This Week" },
  { id: "monthly", label: "This Month" },
];

const MEDAL = ["🥇", "🥈", "🥉"];

export default function GlobalLeaderboard({ initialRows }: { initialRows: Row[] }) {
  const [period, setPeriod] = useState<Period>("all");
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return; // initialRows is already the all-time board
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/v1/competitions/leaderboard?period=${period}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setRows(j.data ?? []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period]);

  return (
    <article className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: 12, borderBottom: "1px solid var(--border)" }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              background: period === p.id ? "var(--primary)" : "transparent",
              color: period === p.id ? "#fff" : "var(--text-muted)",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
          No ranked players in this period yet.
        </p>
      ) : (
        <div>
          {rows.map((r) => (
            <div
              key={r.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 16px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <span style={{ width: 30, textAlign: "center", fontWeight: 700, fontSize: r.rank <= 3 ? 18 : 13, color: "var(--text-muted)" }}>
                {r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.level}</div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)" }}>
                {r.score.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
