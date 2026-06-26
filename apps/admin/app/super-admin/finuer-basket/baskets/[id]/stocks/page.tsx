"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Btn, Field, Panel, finuerBasketApi, inputStyle, tableStyle, tdStyle, thStyle } from "@/components/finuer-basket/admin-ui";

type Stock = {
  id: number;
  symbol: string;
  stockName: string;
  exchange: string;
  weightPct: number | null;
  cmp: number | null;
  sortOrder: number;
};

type Basket = {
  id: number;
  basketName: string;
  market: string;
  type: string;
  performance?: { oneYearReturn: number | null };
};

const emptyStock = () => ({
  symbol: "",
  stockName: "",
  exchange: "NSE",
  weightPct: "",
  reason: "",
});

export default function BasketStocksAdminPage() {
  const params = useParams();
  const basketId = params.id as string;

  const [basket, setBasket] = useState<Basket | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyStock());
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [basketRes, stocksRes] = await Promise.all([
      finuerBasketApi(`/api/v1/admin/baskets/${basketId}`),
      finuerBasketApi(`/api/v1/admin/baskets/${basketId}/stocks`),
    ]);
    const bj = await basketRes.json();
    const sj = await stocksRes.json();
    if (bj.ok) setBasket(bj.data);
    if (sj.ok) setStocks(sj.data);
    setLoading(false);
  }, [basketId]);

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
      exchange: s.exchange,
      weightPct: s.weightPct != null ? String(s.weightPct) : "",
      reason: "",
    });
    setEditId(s.id);
    setError("");
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.symbol.trim() || !form.stockName.trim()) {
      setError("Symbol and stock name are required");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      symbol: form.symbol,
      stockName: form.stockName,
      exchange: form.exchange,
      weightPct: form.weightPct !== "" ? Number(form.weightPct) : null,
      reason: form.reason || null,
    };
    const r = await finuerBasketApi(
      editId
        ? `/api/v1/admin/baskets/${basketId}/stocks/${editId}`
        : `/api/v1/admin/baskets/${basketId}/stocks`,
      { method: editId ? "PUT" : "POST", body: JSON.stringify(payload) },
    );
    const j = await r.json();
    setSaving(false);
    if (!j.ok) {
      setError(j.error || "Failed");
      return;
    }
    setOpen(false);
    setInfo("Stock updated. Ensure weights total 100%, then recalculate performance.");
    load();
  }

  async function remove(stockId: number) {
    const reason = prompt("Reason for removal (optional):") ?? "";
    if (!confirm("Remove this stock from the basket?")) return;
    const r = await finuerBasketApi(`/api/v1/admin/baskets/${basketId}/stocks/${stockId}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    });
    const j = await r.json();
    if (!j.ok) {
      alert(j.error || "Failed to remove");
      return;
    }
    load();
  }

  async function recalculate() {
    setRecalculating(true);
    setError("");
    setInfo("");
    const r = await finuerBasketApi(`/api/v1/admin/baskets/${basketId}/recalculate`, { method: "POST" });
    const j = await r.json();
    setRecalculating(false);
    if (!j.ok) {
      setError(j.error || "Recalculation failed");
      return;
    }
    setInfo("Performance recalculated from current holdings.");
    load();
  }

  const totalWeight = stocks.reduce((s, x) => s + (x.weightPct ?? 0), 0);
  const weightsValid = Math.abs(totalWeight - 100) < 0.01;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div>
          <Link href="/super-admin/finuer-basket/baskets" style={{ fontSize: 12, color: "var(--primary, #0ea5e9)", textDecoration: "none" }}>
            ← Back to Basket List
          </Link>
          <h2 style={{ margin: "8px 0 4px", fontSize: 18, fontWeight: 800 }}>
            {basket?.basketName ?? "Basket"} — Holdings
          </h2>
          {basket ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
              {basket.market} · {basket.type} · {stocks.length} stocks ·{" "}
              <span style={{ color: weightsValid ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                {totalWeight.toFixed(1)}% allocated {weightsValid ? "✓" : "(must be 100%)"}
              </span>
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/super-admin/finuer-basket/baskets/${basketId}?edit=1`}>
            <Btn variant="ghost">Edit Basket</Btn>
          </Link>
          <Btn onClick={recalculate} disabled={recalculating || !weightsValid || stocks.length === 0}>
            {recalculating ? "Calculating…" : "Recalculate Performance"}
          </Btn>
          <Btn onClick={openCreate}>+ Add Stock</Btn>
        </div>
      </div>

      {info ? <p style={{ fontSize: 12, color: "#22c55e", marginBottom: 12 }}>{info}</p> : null}
      {error ? <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>{error}</p> : null}

      <Panel title="Holdings (weights must sum to 100%)">
        {loading ? (
          <p>Loading…</p>
        ) : stocks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 12px", color: "var(--text-muted)" }}>
            <p style={{ margin: "0 0 12px" }}>No stocks added yet. Add constituent stocks to complete this basket.</p>
            <Btn onClick={openCreate}>Add First Stock</Btn>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Symbol", "Stock Name", "Exchange", "Weight %", "CMP", "Actions"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.id}>
                  <td style={tdStyle}><strong>{s.symbol}</strong></td>
                  <td style={tdStyle}>{s.stockName}</td>
                  <td style={tdStyle}>{s.exchange}</td>
                  <td style={tdStyle}>{s.weightPct != null ? `${s.weightPct}%` : "—"}</td>
                  <td style={tdStyle}>{s.cmp != null ? `₹${s.cmp.toLocaleString("en-IN")}` : "—"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn variant="ghost" onClick={() => openEdit(s)}>Edit</Btn>
                      <Btn variant="danger" onClick={() => remove(s.id)}>Remove</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>
              {editId ? "Edit Stock" : "Add Stock to Basket"}
            </h3>
            <form onSubmit={onSubmit}>
              <Field label="Symbol *">
                <input
                  style={inputStyle}
                  value={form.symbol}
                  onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                  placeholder="e.g. HAL"
                />
              </Field>
              <Field label="Stock Name *">
                <input
                  style={inputStyle}
                  value={form.stockName}
                  onChange={(e) => setForm((f) => ({ ...f, stockName: e.target.value }))}
                  placeholder="e.g. Hindustan Aeronautics"
                />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Exchange">
                  <select style={inputStyle} value={form.exchange} onChange={(e) => setForm((f) => ({ ...f, exchange: e.target.value }))}>
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                </Field>
                <Field label="Weight % *">
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.01"
                    value={form.weightPct}
                    onChange={(e) => setForm((f) => ({ ...f, weightPct: e.target.value }))}
                    placeholder="e.g. 12.5"
                  />
                </Field>
              </div>
              <Field label="Reason (optional)">
                <input
                  style={inputStyle}
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Quarterly rebalance — increased IT exposure"
                />
              </Field>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
                CMP is fetched automatically when the stock is added. Returns are calculated by the system.
              </p>
              {error ? <p style={{ color: "#ef4444", fontSize: 12 }}>{error}</p> : null}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Btn type="submit" disabled={saving}>{saving ? "Saving…" : editId ? "Update Stock" : "Add Stock"}</Btn>
                <Btn type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
