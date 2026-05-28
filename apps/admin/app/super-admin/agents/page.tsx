"use client";

import { useState, useEffect, useRef } from "react";

const MODELS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (fast)" },
  { value: "gemini-2.0-flash-thinking-exp", label: "Gemini 2.0 Flash Thinking" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (powerful)" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
];

const AVATAR_OPTIONS = ["🤖","🧠","📈","💡","🎯","🔍","💬","🌟","⚡","🛡️","🎓","🏦","📊","🔮","🦾","💎"];

interface Agent {
  id: number;
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  isActive: boolean;
  createdAt: string;
  createdBy: { fullName: string; role: string };
  _count: { sessions: number };
}

type ModalMode = "create" | "edit" | null;

const emptyForm = () => ({
  name: "", description: "", avatar: "🤖", systemPrompt: "",
  model: "gemini-2.0-flash", temperature: 0.7, isActive: true,
});

function getAuthToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return m ? m[1] : null;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = getAuthToken();
  return fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers } });
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);

  async function loadAgents() {
    setLoading(true);
    const res = await apiFetch("/api/v1/admin/agents");
    const json = await res.json();
    if (json.ok) setAgents(json.data);
    setLoading(false);
  }

  useEffect(() => { loadAgents(); }, []);

  function openCreate() {
    setForm(emptyForm()); setEditTarget(null); setError(""); setModal("create");
  }
  function openEdit(a: Agent) {
    setForm({ name: a.name, description: a.description, avatar: a.avatar, systemPrompt: a.systemPrompt, model: a.model, temperature: a.temperature, isActive: a.isActive });
    setEditTarget(a); setError(""); setModal("edit");
  }

  async function save() {
    if (!form.name.trim() || !form.description.trim() || !form.systemPrompt.trim()) {
      setError("Name, description and instructions are required."); return;
    }
    setSaving(true); setError("");
    try {
      const isEdit = modal === "edit" && editTarget;
      const res = await apiFetch(isEdit ? `/api/v1/admin/agents/${editTarget.id}` : "/api/v1/admin/agents", {
        method: isEdit ? "PUT" : "POST", body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error || "Failed"); return; }
      setModal(null); loadAgents();
    } finally { setSaving(false); }
  }

  async function toggleActive(a: Agent) {
    await apiFetch(`/api/v1/admin/agents/${a.id}`, { method: "PUT", body: JSON.stringify({ isActive: !a.isActive }) });
    loadAgents();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await apiFetch(`/api/v1/admin/agents/${deleteId}`, { method: "DELETE" });
    setDeleteId(null); loadAgents();
  }

  const inp = (field: string, val: string | number | boolean) => setForm(f => ({ ...f, [field]: val }));

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>AI Agents</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Create custom Gemini agents for Virtual Lab users</p>
        </div>
        <button onClick={openCreate} style={{ padding: "10px 22px", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          + Create Agent
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 180, background: "#e2e8f0", borderRadius: 14, animation: "pulse 1.5s infinite" }} />)}
        </div>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>
          <div style={{ fontSize: 48 }}>🤖</div>
          <p style={{ marginTop: 12, fontSize: 15, fontWeight: 600 }}>No agents yet</p>
          <p style={{ fontSize: 13 }}>Create your first Gemini agent to get started</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {agents.map(a => (
            <div key={a.id} style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", position: "relative" }}>
              {!a.isActive && (
                <div style={{ position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 6 }}>INACTIVE</div>
              )}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                  {a.avatar}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{MODELS.find(m => m.value === a.model)?.label ?? a.model}</div>
                </div>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.description}</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{a._count.sessions} chats • by {a.createdBy.fullName}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => toggleActive(a)} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, cursor: "pointer", background: a.isActive ? "#f0fdf4" : "#fff", color: a.isActive ? "#16a34a" : "#64748b", fontWeight: 600 }}>
                    {a.isActive ? "Active" : "Enable"}
                  </button>
                  <button onClick={() => openEdit(a)} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "#fff", color: "#0f172a", fontWeight: 600 }}>Edit</button>
                  <button onClick={() => setDeleteId(a.id)} style={{ padding: "4px 10px", border: "1px solid #fee2e2", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "#fff", color: "#dc2626", fontWeight: 600 }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", padding: "28px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{modal === "create" ? "Create Agent" : "Edit Agent"}</h2>
              <button onClick={() => setModal(null)} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
            </div>

            {/* Avatar picker */}
            <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>AVATAR</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {AVATAR_OPTIONS.map(em => (
                <button key={em} onClick={() => inp("avatar", em)}
                  style={{ width: 40, height: 40, borderRadius: 8, border: form.avatar === em ? "2px solid #6366f1" : "2px solid #e2e8f0", background: form.avatar === em ? "#ede9fe" : "#f8fafc", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {em}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>NAME *</label>
                <input value={form.name} onChange={e => inp("name", e.target.value)} placeholder="e.g. Investment Advisor"
                  style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>MODEL</label>
                <select value={form.model} onChange={e => inp("model", e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none", boxSizing: "border-box" }}>
                  {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>DESCRIPTION *</label>
              <input value={form.description} onChange={e => inp("description", e.target.value)} placeholder="Brief description shown to users"
                style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>SYSTEM INSTRUCTIONS *</label>
              <textarea ref={promptRef} value={form.systemPrompt} onChange={e => inp("systemPrompt", e.target.value)}
                rows={7} placeholder="You are an expert financial advisor specializing in Indian markets. Help users with..."
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                  TEMPERATURE: {form.temperature.toFixed(1)}
                </label>
                <input type="range" min={0} max={2} step={0.1} value={form.temperature} onChange={e => inp("temperature", parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#6366f1" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8" }}>
                  <span>Precise</span><span>Balanced</span><span>Creative</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Active</label>
                <button onClick={() => inp("isActive", !form.isActive)}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: form.isActive ? "#6366f1" : "#e2e8f0", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                  <span style={{ position: "absolute", top: 2, left: form.isActive ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
              </div>
            </div>

            {error && <div style={{ marginBottom: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>{error}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ padding: "10px 22px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer", background: "#fff", color: "#374151" }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: "10px 28px", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : modal === "create" ? "Create Agent" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "28px 32px", maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>Delete this agent?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>All chat sessions will be permanently deleted.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: "9px 22px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", background: "#fff" }}>Cancel</button>
              <button onClick={confirmDelete} style={{ padding: "9px 22px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
