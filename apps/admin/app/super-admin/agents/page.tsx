"use client";

import { useState, useEffect } from "react";
import { LoadingRows } from "@/components/loading-shimmer";

// Use the "-latest" aliases: they always track Google's current model, so they
// don't 404 when a specific dated version (2.0-flash, 2.5-flash, …) is retired.
const MODELS = [
  { value: "gemini-flash-latest",      label: "Gemini Flash (latest) — recommended" },
  { value: "gemini-flash-lite-latest", label: "Gemini Flash Lite (latest) — fastest" },
  { value: "gemini-pro-latest",        label: "Gemini Pro (latest) — most capable" },
];

interface Agent {
  id: number;
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  isActive: boolean;
  isSiteAssistant: boolean;
  createdAt: string;
  createdBy: { fullName: string };
  _count: { sessions: number };
}

const AVATAR_PRESETS = ["🤖", "💬", "📈", "💡", "🧠", "🦉", "🎯", "🛡️", "🚀", "💹", "🧾", "🔍"];

const DOC_CAPABILITY = `

# Documents
Users can attach PDF or Word (.docx) files. When a document is included in a message, read it carefully, summarize key points, and explain any tables clearly. Do not invent figures that are not in the document.`;

const empty = () => ({
  name: "",
  description: "",
  systemPrompt:
    "# Role & Objective\nYou are a helpful finance assistant for Finuer users.\n\n# Style\nBe clear, concise, and use Indian market context when relevant." +
    DOC_CAPABILITY,
  avatar: "🤖",
  model: "gemini-flash-latest",
  temperature: 0.7,
  isActive: true,
});

function getToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return m ? m[1] : null;
}
async function api(path: string, opts?: RequestInit) {
  const t = getToken();
  return fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}), ...opts?.headers } });
}

export default function AgentsPage() {
  const [agents, setAgents]     = useState<Agent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState(empty());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [query, setQuery]       = useState("");

  const shown = agents.filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      (a.description || "").toLowerCase().includes(q) ||
      a.model.toLowerCase().includes(q)
    );
  });

  async function load() {
    setLoading(true);
    const r = await api("/api/v1/admin/agents");
    const j = await r.json();
    if (j.ok) setAgents(j.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() { setForm(empty()); setEditId(null); setError(""); setOpen(true); }
  function openEdit(a: Agent) {
    setForm({ name: a.name, description: a.description, systemPrompt: a.systemPrompt, avatar: a.avatar || "🤖", model: a.model, temperature: a.temperature, isActive: a.isActive });
    setEditId(a.id); setError(""); setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.systemPrompt.trim()) { setError("Name and Instructions are required."); return; }
    setSaving(true); setError("");
    try {
      const r = await api(editId ? `/api/v1/admin/agents/${editId}` : "/api/v1/admin/agents", {
        method: editId ? "PUT" : "POST", body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error || "Failed"); return; }
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  async function toggle(a: Agent) {
    await api(`/api/v1/admin/agents/${a.id}`, { method: "PUT", body: JSON.stringify({ isActive: !a.isActive }) });
    load();
  }

  async function setAssistant(a: Agent) {
    await api(`/api/v1/admin/agents/${a.id}`, {
      method: "PUT",
      body: JSON.stringify({ isSiteAssistant: !a.isSiteAssistant, ...(a.isSiteAssistant ? {} : { isActive: true }) }),
    });
    load();
  }

  async function del() {
    if (!deleteId) return;
    await api(`/api/v1/admin/agents/${deleteId}`, { method: "DELETE" });
    setDeleteId(null); load();
  }

  const f = (k: string, v: string | number | boolean) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "var(--surface-2)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)" }}>AI Agents</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Create custom Gemini agents for Virtual Lab — every agent supports PDF / Word (.docx) attachments
          </p>
        </div>
        <button onClick={openCreate} style={{ padding: "10px 22px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 24, fontWeight: 600, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>
          Create agent
        </button>
      </div>

      {/* Search */}
      {(agents.length > 0 || query) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240, maxWidth: 460 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents by name, description or model…"
              style={{ width: "100%", height: 42, paddingLeft: 40, paddingRight: 36, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
            )}
          </div>
          {query && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {shown.length} of {agents.length}
            </span>
          )}
        </div>
      )}

      {/* Agent cards */}
      {loading ? (
        <LoadingRows />
      ) : agents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#e8f0fe,#d2e3fc)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🤖</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 6px" }}>No agents yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Create your first agent to get started</p>
        </div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <p style={{ marginTop: 12, fontSize: 14 }}>No agents match “{query.trim()}”.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
          {shown.map(a => (
            <div key={a.id} style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: "20px 22px", position: "relative" }}>
              {!a.isActive && <span style={{ position: "absolute", top: 14, right: 14, fontSize: 10, fontWeight: 600, background: "#fce8e6", color: "#c5221f", padding: "2px 8px", borderRadius: 10 }}>INACTIVE</span>}
              {a.isSiteAssistant && a.isActive && <span style={{ position: "absolute", top: 14, right: 14, fontSize: 10, fontWeight: 600, background: "#e6f4ea", color: "#1e8e3e", padding: "2px 8px", borderRadius: 10 }}>💬 CHATBOT</span>}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#e8f0fe,#d2e3fc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🤖</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.model}</div>
                </div>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {a.description || a.systemPrompt.slice(0, 100)}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{a._count.sessions} chats</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => setAssistant(a)} title="Use this agent as the site-wide chatbot" style={{ fontSize: 11, padding: "4px 12px", border: `1px solid ${a.isSiteAssistant ? "#1e8e3e" : "var(--border)"}`, borderRadius: 20, background: a.isSiteAssistant ? "#e6f4ea" : "var(--surface)", cursor: "pointer", fontWeight: 500, color: a.isSiteAssistant ? "#1e8e3e" : "var(--text-muted)" }}>
                    {a.isSiteAssistant ? "💬 Chatbot ✓" : "Set as chatbot"}
                  </button>
                  <button onClick={() => toggle(a)} style={{ fontSize: 11, padding: "4px 12px", border: "1px solid var(--border)", borderRadius: 20, background: "var(--surface)", cursor: "pointer", fontWeight: 500, color: a.isActive ? "#1e8e3e" : "var(--text-muted)" }}>
                    {a.isActive ? "● Active" : "○ Inactive"}
                  </button>
                  <button onClick={() => openEdit(a)} style={{ fontSize: 11, padding: "4px 12px", border: "1px solid var(--border)", borderRadius: 20, background: "var(--surface)", cursor: "pointer", fontWeight: 500, color: "#1a73e8" }}>Edit</button>
                  <button onClick={() => setDeleteId(a.id)} style={{ fontSize: 11, padding: "4px 12px", border: "1px solid #fad2cf", borderRadius: 20, background: "var(--surface)", cursor: "pointer", fontWeight: 500, color: "#c5221f" }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit drawer — matches Gemini Gems layout */}
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: "100%", maxWidth: 540, height: "100%", background: "var(--surface)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {/* Drawer header */}
            <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{editId ? "Edit agent" : "Create an agent"}</h2>
              <button onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>×</button>
            </div>

            {/* Form body — Gemini Gems style */}
            <div style={{ padding: "28px 28px 0", flex: 1 }}>
              {/* Name */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Name</label>
                <input value={form.name} onChange={e => f("name", e.target.value)}
                  placeholder="e.g. Volatility Calendar"
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, outline: "none", color: "var(--text)", boxSizing: "border-box" }} />
              </div>

              {/* Icon */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Icon</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#ede9fe,#c7d2fe)", display: "grid", placeItems: "center", fontSize: 24, flexShrink: 0 }}>{form.avatar}</span>
                  <input value={form.avatar} onChange={e => f("avatar", e.target.value.slice(0, 4))} maxLength={4}
                    aria-label="Agent icon emoji"
                    style={{ width: 64, textAlign: "center", padding: "10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 18, outline: "none", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {AVATAR_PRESETS.map(em => (
                      <button key={em} type="button" onClick={() => f("avatar", em)}
                        style={{ width: 34, height: 34, borderRadius: 8, border: form.avatar === em ? "2px solid #1a73e8" : "1px solid var(--border)", background: "var(--surface)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Description</label>
                <input value={form.description} onChange={e => f("description", e.target.value)}
                  placeholder="Describe your agent and explain what it does"
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 14, outline: "none", color: "var(--text)", boxSizing: "border-box" }} />
              </div>

              {/* Instructions */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Instructions</label>
                <textarea value={form.systemPrompt} onChange={e => f("systemPrompt", e.target.value)}
                  rows={10}
                  placeholder={"# Role & Objective\nYou are a…\n\n# Documents\nUsers can attach PDF or Word (.docx)…"}
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, color: "var(--text)", boxSizing: "border-box" }} />
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
                  PDF / Word attach is built into every chat UI — keep a short Documents section so the model handles uploads well.
                </p>
              </div>

              {/* Model + Temperature — collapsed "advanced" row */}
              <details style={{ marginBottom: 24 }}>
                <summary style={{ fontSize: 13, fontWeight: 600, color: "#1a73e8", cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  ⚙ Advanced settings
                </summary>
                <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 5 }}>Model</label>
                    <select value={form.model} onChange={e => f("model", e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, background: "var(--surface)", outline: "none" }}>
                      {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 5 }}>Temperature: {form.temperature.toFixed(1)}</label>
                    <input type="range" min={0} max={2} step={0.1} value={form.temperature} onChange={e => f("temperature", parseFloat(e.target.value))}
                      style={{ width: "100%", accentColor: "#1a73e8", marginTop: 8 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      <span>Precise</span><span>Creative</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 13, color: "var(--text)" }}>Active</label>
                  <button type="button" onClick={() => f("isActive", !form.isActive)}
                    style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: form.isActive ? "#1a73e8" : "var(--border)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                    <span style={{ position: "absolute", top: 2, left: form.isActive ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "var(--surface)", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
              </details>

              {error && <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fce8e6", borderRadius: 8, fontSize: 13, color: "#c5221f" }}>{error}</div>}
            </div>

            {/* Footer actions */}
            <div style={{ padding: "16px 28px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 12, justifyContent: "flex-end", flexShrink: 0 }}>
              <button onClick={() => setOpen(false)} style={{ padding: "10px 24px", border: "1.5px solid var(--border)", borderRadius: 24, fontWeight: 600, fontSize: 14, cursor: "pointer", background: "var(--surface)", color: "var(--text)" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: "10px 28px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 24, fontWeight: 600, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : editId ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: "28px 32px", maxWidth: 360, textAlign: "center" }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>Delete this agent?</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 22px" }}>All chat sessions will be permanently removed.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: "9px 22px", border: "1.5px solid var(--border)", borderRadius: 24, fontWeight: 600, fontSize: 13, cursor: "pointer", background: "var(--surface)" }}>Cancel</button>
              <button onClick={del} style={{ padding: "9px 22px", background: "#c5221f", color: "#fff", border: "none", borderRadius: 24, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
