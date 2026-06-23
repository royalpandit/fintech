"use client";

import { FormEvent, useEffect, useState } from "react";
import { Btn, Field, Panel, finuerBasketApi, inputStyle, tableStyle, tdStyle, thStyle } from "@/components/finuer-basket/admin-ui";

type Market = { id: number; name: string };
type Benchmark = { id: number; marketId: number; marketName: string | null; name: string };

export default function BenchmarksAdminPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [rows, setRows] = useState<Benchmark[]>([]);
  const [marketId, setMarketId] = useState("");
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [filterMarketId, setFilterMarketId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadMarkets() {
    const r = await finuerBasketApi("/api/v1/admin/markets");
    const j = await r.json();
    if (j.ok) setMarkets(j.data);
  }

  async function loadBenchmarks() {
    setLoading(true);
    const qs = filterMarketId ? `?market_id=${filterMarketId}` : "";
    const r = await finuerBasketApi(`/api/v1/admin/benchmarks${qs}`);
    const j = await r.json();
    if (j.ok) setRows(j.data);
    setLoading(false);
  }

  useEffect(() => {
    loadMarkets();
  }, []);

  useEffect(() => {
    loadBenchmarks();
  }, [filterMarketId]);

  function resetForm() {
    setMarketId("");
    setName("");
    setEditId(null);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !marketId) {
      setError("Market and name are required");
      return;
    }
    const r = await finuerBasketApi(
      editId ? `/api/v1/admin/benchmarks/${editId}` : "/api/v1/admin/benchmarks",
      {
        method: editId ? "PUT" : "POST",
        body: JSON.stringify({ marketId: Number(marketId), name }),
      },
    );
    const j = await r.json();
    if (!j.ok) {
      setError(j.error || "Failed");
      return;
    }
    resetForm();
    loadBenchmarks();
  }

  async function remove(id: number) {
    if (!confirm("Delete this benchmark?")) return;
    const r = await finuerBasketApi(`/api/v1/admin/benchmarks/${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!j.ok) alert(j.error || "Delete failed");
    else loadBenchmarks();
  }

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 320px" }}>
      <Panel title="Benchmarks">
        <div style={{ marginBottom: 12 }}>
          <select
            style={{ ...inputStyle, maxWidth: 280 }}
            value={filterMarketId}
            onChange={(e) => setFilterMarketId(e.target.value)}
          >
            <option value="">All Markets</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Market", "Benchmark", "Actions"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.marketName ?? row.marketId}</td>
                  <td style={tdStyle}>{row.name}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn
                        variant="ghost"
                        onClick={() => {
                          setEditId(row.id);
                          setMarketId(String(row.marketId));
                          setName(row.name);
                        }}
                      >
                        Edit
                      </Btn>
                      <Btn variant="danger" onClick={() => remove(row.id)}>
                        Delete
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title={editId ? "Edit Benchmark" : "Add Benchmark"}>
        <form onSubmit={onSubmit}>
          <Field label="Market *">
            <select style={inputStyle} value={marketId} onChange={(e) => setMarketId(e.target.value)}>
              <option value="">Select market</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Benchmark Name *">
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {error ? <p style={{ color: "#ef4444", fontSize: 12 }}>{error}</p> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn type="submit">{editId ? "Update" : "Add Benchmark"}</Btn>
            {editId ? <Btn variant="ghost" onClick={resetForm}>Cancel</Btn> : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}
