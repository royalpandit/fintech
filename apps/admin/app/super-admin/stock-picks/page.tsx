"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Group = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  iconEmoji: string;
  performancePct: number | null;
  benchmarkPct: number | null;
  sortOrder: number;
  isPublished: boolean;
  stockCount: number;
};

const emptyGroup = () => ({
  name: "",
  description: "",
  category: "",
  iconEmoji: "📈",
  performancePct: "",
  benchmarkPct: "",
  sortOrder: 0,
  isPublished: false,
});

function getToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return m ? m[1] : null;
}

async function api(path: string, opts?: RequestInit) {
  const t = getToken();
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...opts?.headers,
    },
  });
}

export default function StockPicksAdminPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyGroup());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const r = await api("/api/v1/admin/stock-pick-groups");
    const j = await r.json();
    if (j.ok) setGroups(j.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyGroup());
    setEditId(null);
    setError("");
    setOpen(true);
  }

  function openEdit(g: Group) {
    setForm({
      name: g.name,
      description: g.description ?? "",
      category: g.category ?? "",
      iconEmoji: g.iconEmoji,
      performancePct: g.performancePct != null ? String(g.performancePct) : "",
      benchmarkPct: g.benchmarkPct != null ? String(g.benchmarkPct) : "",
      sortOrder: g.sortOrder,
      isPublished: g.isPublished,
    });
    setEditId(g.id);
    setError("");
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Group name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        description: form.description,
        category: form.category,
        iconEmoji: form.iconEmoji,
        performancePct: form.performancePct !== "" ? Number(form.performancePct) : null,
        benchmarkPct: form.benchmarkPct !== "" ? Number(form.benchmarkPct) : null,
        sortOrder: Number(form.sortOrder) || 0,
        isPublished: form.isPublished,
      };
      const r = await api(
        editId ? `/api/v1/admin/stock-pick-groups/${editId}` : "/api/v1/admin/stock-pick-groups",
        { method: editId ? "PUT" : "POST", body: JSON.stringify(payload) },
      );
      const j = await r.json();
      if (!j.ok) {
        setError(j.error || "Failed");
        return;
      }
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(g: Group) {
    await api(`/api/v1/admin/stock-pick-groups/${g.id}`, {
      method: "PUT",
      body: JSON.stringify({ isPublished: !g.isPublished }),
    });
    load();
  }

  async function del() {
    if (!deleteId) return;
    await api(`/api/v1/admin/stock-pick-groups/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  }

  const f = (k: string, v: string | number | boolean) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "var(--surface-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)" }}>AI Stock Picks</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Create strategy groups, add stocks, and publish to the mobile app
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          style={{
            padding: "10px 22px",
            background: "#1a73e8",
            color: "#fff",
            border: "none",
            borderRadius: 24,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Create Group
        </button>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", padding: 40 }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#e0f2fe,#dbeafe)",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
            }}
          >
            📊
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 6px" }}>
            No stock pick groups yet
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Create your first group (e.g. Tech Titans, Dividend Kings)
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {groups.map((g) => (
            <div
              key={g.id}
              style={{
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 28 }}>{g.iconEmoji}</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{g.name}</span>
                  {!g.isPublished && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: "#fef9c3",
                        color: "#a16207",
                        padding: "2px 8px",
                        borderRadius: 10,
                      }}
                    >
                      DRAFT
                    </span>
                  )}
                  {g.isPublished && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: "#dcfce7",
                        color: "#15803d",
                        padding: "2px 8px",
                        borderRadius: 10,
                      }}
                    >
                      LIVE
                    </span>
                  )}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  {g.category || "Uncategorized"} · {g.stockCount} stocks ·{" "}
                  {g.performancePct != null ? `${g.performancePct >= 0 ? "+" : ""}${g.performancePct}%` : "—"} vs
                  bench {g.benchmarkPct != null ? `${g.benchmarkPct}%` : "—"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link
                  href={`/super-admin/stock-picks/${g.id}`}
                  style={{
                    fontSize: 12,
                    padding: "6px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 20,
                    background: "var(--surface)",
                    fontWeight: 600,
                    color: "#1a73e8",
                    textDecoration: "none",
                  }}
                >
                  Manage Stocks
                </Link>
                <button
                  type="button"
                  onClick={() => togglePublish(g)}
                  style={{
                    fontSize: 12,
                    padding: "6px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 20,
                    background: "var(--surface)",
                    cursor: "pointer",
                    fontWeight: 600,
                    color: g.isPublished ? "#1e8e3e" : "var(--text-muted)",
                  }}
                >
                  {g.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(g)}
                  style={{
                    fontSize: 12,
                    padding: "6px 14px",
                    border: "1px solid var(--border)",
                    borderRadius: 20,
                    background: "var(--surface)",
                    cursor: "pointer",
                    fontWeight: 600,
                    color: "#1a73e8",
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(g.id)}
                  style={{
                    fontSize: 12,
                    padding: "6px 14px",
                    border: "1px solid #fad2cf",
                    borderRadius: 20,
                    background: "var(--surface)",
                    cursor: "pointer",
                    fontWeight: 600,
                    color: "#c5221f",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 200,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              height: "100%",
              background: "var(--surface)",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>
              {editId ? "Edit Group" : "Create Group"}
            </h2>
            {error && (
              <p style={{ color: "#c5221f", fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}
            {[
              { key: "name", label: "Group Name *", placeholder: "Tech Titans" },
              { key: "category", label: "Category / Strategy", placeholder: "Growth" },
              { key: "iconEmoji", label: "Icon (emoji)", placeholder: "📈" },
              { key: "description", label: "Description", placeholder: "Top tech large caps…", multiline: true },
            ].map((field) => (
              <label key={field.key} style={{ display: "block", marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{field.label}</span>
                {field.multiline ? (
                  <textarea
                    value={(form as unknown as Record<string, string>)[field.key]}
                    onChange={(e) => f(field.key, e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                ) : (
                  <input
                    value={(form as unknown as Record<string, string>)[field.key]}
                    onChange={(e) => f(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                )}
              </label>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <label style={{ display: "block" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Performance %</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.performancePct}
                  onChange={(e) => f("performancePct", e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                />
              </label>
              <label style={{ display: "block" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Benchmark %</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.benchmarkPct}
                  onChange={(e) => f("benchmarkPct", e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                />
              </label>
            </div>
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Sort Order</span>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => f("sortOrder", Number(e.target.value))}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => f("isPublished", e.target.checked)}
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Publish group (visible in app)</span>
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: "none",
                  background: "#1a73e8",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 210,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, maxWidth: 360 }}>
            <p style={{ margin: "0 0 16px", fontWeight: 600 }}>Delete this group and all its stocks?</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setDeleteId(null)} style={{ flex: 1, padding: 10 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={del}
                style={{
                  flex: 1,
                  padding: 10,
                  background: "#c5221f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
