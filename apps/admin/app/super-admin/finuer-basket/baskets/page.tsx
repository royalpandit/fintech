"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Btn, Panel, finuerBasketApi, tableStyle, tdStyle, thStyle } from "@/components/finuer-basket/admin-ui";

type Basket = {
  id: number;
  basketName: string;
  market: string;
  type: string;
  benchmark: string;
  status: string;
  visibility: string;
  stockCount?: number;
  createdBy: { fullName: string } | null;
  createdAt: string;
  performance: { oneYearReturn: number | null };
};

type Market = { id: number; name: string };
type BasketType = { id: number; name: string };

export default function BasketListAdminPage() {
  const [rows, setRows] = useState<Basket[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [types, setTypes] = useState<BasketType[]>([]);
  const [marketId, setMarketId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [timePeriod, setTimePeriod] = useState("1_year");
  const [sortOrder, setSortOrder] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadMeta() {
    const [m, t] = await Promise.all([
      finuerBasketApi("/api/v1/admin/markets"),
      finuerBasketApi("/api/v1/admin/types"),
    ]);
    const mj = await m.json();
    const tj = await t.json();
    if (mj.ok) setMarkets(mj.data);
    if (tj.ok) setTypes(tj.data);
  }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (marketId) params.set("market_id", marketId);
    if (typeId) params.set("type_id", typeId);
    if (timePeriod) params.set("time_period", timePeriod);
    if (sortOrder) params.set("sort_order", sortOrder);
    const r = await finuerBasketApi(`/api/v1/admin/baskets?${params}`);
    const j = await r.json();
    if (j.ok) setRows(j.data);
    setLoading(false);
  }

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    load();
  }, [marketId, typeId, timePeriod, sortOrder]);

  async function toggleStatus(id: number, status: "active" | "inactive") {
    await finuerBasketApi(`/api/v1/admin/baskets/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this basket?")) return;
    const r = await finuerBasketApi(`/api/v1/admin/baskets/${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!j.ok) alert(j.error || "Delete failed");
    else load();
  }

  return (
    <Panel title="Basket List">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <select value={marketId} onChange={(e) => setMarketId(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
          <option value="">All Markets</option>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
          <option value="">All Types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
          <option value="1_month">1 Month</option>
          <option value="6_months">6 Months</option>
          <option value="1_year">1 Year</option>
          <option value="3_years">3 Years</option>
          <option value="5_years">5 Years</option>
          <option value="since_launch">Since Launch</option>
        </select>
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
          <option value="">Default Sort</option>
          <option value="highest_return">Highest Return</option>
          <option value="lowest_return">Lowest Return</option>
        </select>
        <Link href="/super-admin/finuer-basket/baskets/new">
          <Btn>Create Basket</Btn>
        </Link>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {[
                  "Basket Name",
                  "Market",
                  "Type",
                  "Benchmark",
                  "Stocks",
                  "Status",
                  "Visibility",
                  "Created By",
                  "Created",
                  "Actions",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.basketName}</td>
                  <td style={tdStyle}>{row.market}</td>
                  <td style={tdStyle}>{row.type}</td>
                  <td style={tdStyle}>{row.benchmark}</td>
                  <td style={tdStyle}>
                    {(row.stockCount ?? 0) > 0 ? (
                      row.stockCount
                    ) : (
                      <span style={{ color: "var(--warning, #d97706)", fontWeight: 600 }}>0 — add stocks</span>
                    )}
                  </td>
                  <td style={tdStyle}>{row.status}</td>
                  <td style={tdStyle}>{row.visibility}</td>
                  <td style={tdStyle}>{row.createdBy?.fullName ?? "—"}</td>
                  <td style={tdStyle}>{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <Link href={`/super-admin/finuer-basket/baskets/${row.id}/stocks`}>
                        <Btn variant="ghost">Stocks</Btn>
                      </Link>
                      <Link href={`/super-admin/finuer-basket/baskets/${row.id}`}>
                        <Btn variant="ghost">View</Btn>
                      </Link>
                      <Link href={`/super-admin/finuer-basket/baskets/${row.id}?edit=1`}>
                        <Btn variant="ghost">Edit</Btn>
                      </Link>
                      {row.status === "active" ? (
                        <Btn variant="ghost" onClick={() => toggleStatus(row.id, "inactive")}>
                          Deactivate
                        </Btn>
                      ) : (
                        <Btn variant="ghost" onClick={() => toggleStatus(row.id, "active")}>
                          Activate
                        </Btn>
                      )}
                      <Btn variant="danger" onClick={() => remove(row.id)}>
                        Delete
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
