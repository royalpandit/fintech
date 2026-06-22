"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RECOMMENDATION_LABELS } from "@/lib/stock-picks";

type Stock = {
  id: number;
  symbol: string;
  stockName: string;
  cmp: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  recommendation: string;
  analystNote: string | null;
  sortOrder: number;
  isPublished: boolean;
};

type Group = {
  id: number;
  name: string;
  slug: string;
  stocks?: Stock[];
};

const RECS = Object.keys(RECOMMENDATION_LABELS);

const emptyStock = () => ({
  symbol: "",
  stockName: "",
  cmp: "",
  targetPrice: "",
  stopLoss: "",
  recommendation: "buy",
  analystNote: "",
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

export default function StockPickGroupStocksPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyStock());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api(`/api/v1/admin/stock-pick-groups/${groupId}`);
    const j = await r.json();
    if (j.ok) {
      setGroup(j.data);
      setStocks(j.data.stocks ?? []);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(emptyStock());
    setEditId(null);
    setError("");
    setOpen(true);
  }

  function openEdit(s: Stock) {
    setForm({
      symbol: s.symbol,
      stockName: s.stockName,
      cmp: s.cmp != null ? String(s.cmp) : "",
      targetPrice: s.targetPrice != null ? String(s.targetPrice) : "",
      stopLoss: s.stopLoss != null ? String(s.stopLoss) : "",
      recommendation: s.recommendation,
      analystNote: s.analystNote ?? "",
      isPublished: s.isPublished,
    });
    setEditId(s.id);
    setError("");
    setOpen(true);
  }

  async function save() {
    if (!form.symbol.trim() || !form.stockName.trim()) {
      setError("Symbol and stock name are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        symbol: form.symbol,
        stockName: form.stockName,
        cmp: form.cmp !== "" ? Number(form.cmp) : null,
        targetPrice: form.targetPrice !== "" ? Number(form.targetPrice) : null,
        stopLoss: form.stopLoss !== "" ? Number(form.stopLoss) : null,
        recommendation: form.recommendation,
        analystNote: form.analystNote,
        isPublished: form.isPublished,
      };
      const r = await api(
        editId
          ? `/api/v1/admin/stock-pick-groups/${groupId}/stocks/${editId}`
          : `/api/v1/admin/stock-pick-groups/${groupId}/stocks`,
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

  async function togglePublish(s: Stock) {
    await api(`/api/v1/admin/stock-pick-groups/${groupId}/stocks/${s.id}`, {
      method: "PUT",
      body: JSON.stringify({ isPublished: !s.isPublished }),
    });
    load();
  }

  async function removeStock(id: number) {
    if (!confirm("Remove this stock from the group?")) return;
    await api(`/api/v1/admin/stock-pick-groups/${groupId}/stocks/${id}`, {
      method: "DELETE",
    });
    load();
  }

  async function moveStock(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= stocks.length) return;
    const reordered = [...stocks];
    const tmp = reordered[index];
    reordered[index] = reordered[next];
    reordered[next] = tmp;
    const order = reordered.map((s, i) => ({ id: s.id, sortOrder: i }));
    await api(`/api/v1/admin/stock-pick-groups/${groupId}/stocks`, {
      method: "PUT",
      body: JSON.stringify({ order }),
    });
    load();
  }

  const f = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ padding: "28px 32px", minHeight: "100vh", background: "var(--surface-2)" }}>
      <Link
        href="/super-admin/stock-picks"
        style={{ fontSize: 13, color: "#1a73e8", textDecoration: "none", fontWeight: 600 }}
      >
        ← Back to Groups
      </Link>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "16px 0 24px",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)" }}>
            {group?.name ?? "Group"} — Stocks
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Add, reorder, publish stocks in this pick group
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
          Add Stock
        </button>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : stocks.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No stocks in this group yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {stocks.map((s, index) => (
            <div
              key={s.id}
              style={{
                background: "var(--surface)",
                borderRadius: 12,
                border: "1px solid var(--border)",
                padding: "16px 20px",
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveStock(index, -1)}
                  style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14 }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === stocks.length - 1}
                  onClick={() => moveStock(index, 1)}
                  style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14 }}
                >
                  ↓
                </button>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{s.symbol}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{s.stockName}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: s.isPublished ? "#dcfce7" : "#f1f5f9",
                      color: s.isPublished ? "#15803d" : "#64748b",
                    }}
                  >
                    {s.isPublished ? "PUBLISHED" : "DRAFT"}
                  </span>
                  <span style={{ fontSize: 11, color: "#1a73e8", fontWeight: 600 }}>
                    {RECOMMENDATION_LABELS[s.recommendation]}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  CMP {s.cmp ?? "—"} · Target {s.targetPrice ?? "—"} · SL {s.stopLoss ?? "—"}
                  {s.analystNote ? ` · ${s.analystNote.slice(0, 80)}…` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => togglePublish(s)}
                  style={{
                    fontSize: 11,
                    padding: "5px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 20,
                    background: "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  {s.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(s)}
                  style={{
                    fontSize: 11,
                    padding: "5px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 20,
                    background: "var(--surface)",
                    cursor: "pointer",
                    color: "#1a73e8",
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeStock(s.id)}
                  style={{
                    fontSize: 11,
                    padding: "5px 12px",
                    border: "1px solid #fad2cf",
                    borderRadius: 20,
                    background: "var(--surface)",
                    cursor: "pointer",
                    color: "#c5221f",
                  }}
                >
                  Remove
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
              maxWidth: 440,
              height: "100%",
              background: "var(--surface)",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600 }}>
              {editId ? "Edit Stock" : "Add Stock"}
            </h2>
            {error && <p style={{ color: "#c5221f", fontSize: 13 }}>{error}</p>}
            {[
              { key: "symbol", label: "Symbol *" },
              { key: "stockName", label: "Stock Name *" },
            ].map((field) => (
              <label key={field.key} style={{ display: "block", marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{field.label}</span>
                <input
                  value={(form as unknown as Record<string, string>)[field.key]}
                  onChange={(e) => f(field.key, e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    boxSizing: "border-box",
                  }}
                />
              </label>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[
                { key: "cmp", label: "CMP" },
                { key: "targetPrice", label: "Target" },
                { key: "stopLoss", label: "Stop Loss" },
              ].map((field) => (
                <label key={field.key}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{field.label}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(form as unknown as Record<string, string>)[field.key]}
                    onChange={(e) => f(field.key, e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                </label>
              ))}
            </div>
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Recommendation</span>
              <select
                value={form.recommendation}
                onChange={(e) => f("recommendation", e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                {RECS.map((r) => (
                  <option key={r} value={r}>
                    {RECOMMENDATION_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Analyst Note</span>
              <textarea
                value={form.analystNote}
                onChange={(e) => f("analystNote", e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  boxSizing: "border-box",
                }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => f("isPublished", e.target.checked)}
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Publish stock (visible when group is live)</span>
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: 12 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "#1a73e8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
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
    </div>
  );
}
