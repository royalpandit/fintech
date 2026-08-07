"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Agent = {
  id: number;
  name: string;
  description: string;
  avatar: string;
  model: string;
  _count: { sessions: number };
};

const SORTS = [
  { key: "default", label: "Default" },
  { key: "popular", label: "Most used" },
  { key: "az", label: "A–Z" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

export default function AgentsBrowser({ agents }: { agents: Agent[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("default");

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = query
      ? agents.filter(
          (a) => a.name.toLowerCase().includes(query) || a.description.toLowerCase().includes(query),
        )
      : agents;
    if (sort === "popular") list = [...list].sort((a, b) => b._count.sessions - a._count.sessions);
    else if (sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [agents, q, sort]);

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 260, maxWidth: 460 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search AI agents…"
            style={{ width: "100%", height: 42, paddingLeft: 40, paddingRight: 14, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Sort:</span>
          {SORTS.map((s) => {
            const active = s.key === sort;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                  background: active ? "var(--primary-soft, rgba(37,99,235,0.12))" : "var(--surface)",
                  color: active ? "var(--accent-blue, #2563eb)" : "var(--text-muted)",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <p style={{ marginTop: 12, fontSize: 14 }}>No agents match “{q.trim()}”.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {shown.map((a) => (
            <Link key={a.id} href={`/user/lab/agents/${a.id}`} style={{ textDecoration: "none" }}>
              <div className="lab-agent-card" style={{ background: "var(--surface)", borderRadius: 16, padding: "22px 22px 18px", border: "1.5px solid var(--border)", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#ede9fe,#c7d2fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                    {a.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>
                      {a.model.replace("gemini-", "Gemini ").replace("-", " ")}
                    </div>
                  </div>
                </div>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {a.description}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{a._count.sessions.toLocaleString()} conversations</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", display: "flex", alignItems: "center", gap: 4 }}>
                    Chat <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
