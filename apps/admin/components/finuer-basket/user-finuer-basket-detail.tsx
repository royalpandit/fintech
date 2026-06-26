"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import FinuerBasketCard, { type FinuerBasketCardData } from "@/components/finuer-basket/finuer-basket-card";
import { formatReturnPct, type FinuerBasketTimePeriod } from "@/lib/finuer-basket";
import { UserPageBackLink, UserPageSection } from "@/components/user/user-page-layout";

type Stock = {
  id: number;
  symbol: string;
  stockName: string;
  exchange: string;
  weightPct: number | null;
  cmp: number | null;
};

type RebalanceEvent = {
  id: number;
  action: string;
  symbol: string;
  stockName: string | null;
  oldWeight: number | null;
  newWeight: number | null;
  reason: string | null;
  createdAt: string;
};

type PerformanceDetail = FinuerBasketCardData["performance"] & {
  benchmarkOneMonth: number | null;
  benchmarkThreeMonth: number | null;
  benchmarkSixMonth: number | null;
  benchmarkOneYear: number | null;
  benchmarkThreeYear: number | null;
  benchmarkFiveYear: number | null;
  benchmarkSinceLaunch: number | null;
};

type BasketDetail = Omit<FinuerBasketCardData, "performance"> & {
  methodology?: string | null;
  lastRebalancedAt?: string | null;
  updatedAt?: string;
  stocks: Stock[];
  rebalanceEvents?: RebalanceEvent[];
  performance: PerformanceDetail;
};

const TABS = ["overview", "holdings", "rebalance", "performance", "compare"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  holdings: "Holdings",
  rebalance: "Rebalance History",
  performance: "Performance",
  compare: "Compare",
};

const PERIODS: { key: FinuerBasketTimePeriod; label: string }[] = [
  { key: "1_month", label: "1M" },
  { key: "3_months", label: "3M" },
  { key: "6_months", label: "6M" },
  { key: "1_year", label: "1Y" },
  { key: "3_years", label: "3Y" },
  { key: "5_years", label: "5Y" },
  { key: "since_launch", label: "Since Launch" },
];

function actionLabel(action: string) {
  if (action === "add") return "Added";
  if (action === "remove") return "Removed";
  if (action === "increase_weight") return "Weight increased";
  if (action === "decrease_weight") return "Weight decreased";
  return action;
}

export default function UserFinuerBasketDetailClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const timePeriod = (searchParams.get("time_period") as FinuerBasketTimePeriod) || "1_year";
  const initialTab = (searchParams.get("tab") as Tab) || "overview";

  const [basket, setBasket] = useState<BasketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab) ? initialTab : "overview");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const r = await fetch(`/api/v1/baskets/${id}?time_period=${timePeriod}`);
      const j = await r.json();
      if (j.ok) setBasket(j.data);
      setLoading(false);
    }
    load();
  }, [id, timePeriod]);

  if (loading) {
    return (
      <UserPageSection>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading basket…</p>
      </UserPageSection>
    );
  }

  if (!basket) {
    return (
      <UserPageSection>
        <UserPageBackLink href="/user/finuer-basket">← Back to Finuer Basket</UserPageBackLink>
        <p style={{ marginTop: 16 }}>Basket not found.</p>
      </UserPageSection>
    );
  }

  const p = basket.performance;
  const totalWeight = (basket.stocks ?? []).reduce((s, x) => s + (x.weightPct ?? 0), 0);

  return (
    <UserPageSection>
      <UserPageBackLink href="/user/finuer-basket">← Back to Finuer Basket</UserPageBackLink>

      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <FinuerBasketCard basket={basket} timePeriod={timePeriod} linkable={false} />
      </div>

      <nav
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border)",
          marginBottom: 20,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: tab === t ? 700 : 500,
              border: "none",
              borderBottom: tab === t ? "2px solid var(--primary, #0ea5e9)" : "2px solid transparent",
              background: "transparent",
              color: tab === t ? "var(--primary, #0ea5e9)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div style={{ display: "grid", gap: 16 }}>
          <section className="user-page-card" style={{ padding: 16 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700 }}>About this basket</h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
              {basket.shortDescription || "No description provided."}
            </p>
          </section>
          {basket.methodology ? (
            <section className="user-page-card" style={{ padding: 16 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700 }}>Methodology</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{basket.methodology}</p>
            </section>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <div className="user-page-card" style={{ padding: 14 }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Stocks</p>
              <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800 }}>{basket.stockCount ?? basket.stocks.length}</p>
            </div>
            <div className="user-page-card" style={{ padding: 14 }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Rebalance</p>
              <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, textTransform: "capitalize" }}>
                {basket.rebalanceFrequency}
              </p>
            </div>
            <div className="user-page-card" style={{ padding: 14 }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Last Updated</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600 }}>
                {basket.lastRebalancedAt
                  ? new Date(basket.lastRebalancedAt).toLocaleDateString("en-IN")
                  : new Date(basket.updatedAt ?? basket.createdAt ?? Date.now()).toLocaleDateString("en-IN")}
              </p>
            </div>
            <div className="user-page-card" style={{ padding: 14 }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Alpha (1Y)</p>
              <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800 }}>
                {p.alpha != null ? formatReturnPct(p.alpha) : "—"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "holdings" ? (
        !basket.stocks?.length ? (
          <div className="user-page-empty">
            <p style={{ margin: 0 }}>Holdings will be published soon.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px" }}>
              {basket.stocks.length} stocks · {totalWeight.toFixed(1)}% allocated
            </p>
            {basket.stocks.map((stock) => (
              <article key={stock.id} className="user-page-card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{stock.symbol}</strong>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{stock.stockName}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                      {stock.weightPct != null ? `${stock.weightPct}%` : "—"}
                    </p>
                    {stock.cmp != null ? (
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                        ₹{stock.cmp.toLocaleString("en-IN")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {tab === "rebalance" ? (
        !basket.rebalanceEvents?.length ? (
          <div className="user-page-empty">
            <p style={{ margin: 0 }}>No rebalance history yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {basket.rebalanceEvents.map((ev) => (
              <article key={ev.id} className="user-page-card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <strong>{actionLabel(ev.action)}</strong>
                    <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>{ev.symbol}</span>
                    {ev.stockName ? (
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{ev.stockName}</p>
                    ) : null}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(ev.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
                {(ev.oldWeight != null || ev.newWeight != null) && (
                  <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                    Weight: {ev.oldWeight ?? "—"}% → {ev.newWeight ?? "—"}%
                  </p>
                )}
                {ev.reason ? (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{ev.reason}</p>
                ) : null}
              </article>
            ))}
          </div>
        )
      ) : null}

      {tab === "performance" ? (
        <div className="user-page-card" style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Returns vs {basket.benchmark}</h3>
          <div className="finuer-basket-returns-grid">
            {PERIODS.map(({ key, label }) => {
              const fieldMap: Record<FinuerBasketTimePeriod, keyof PerformanceDetail> = {
                "1_month": "oneMonthReturn",
                "3_months": "threeMonthReturn",
                "6_months": "sixMonthReturn",
                "1_year": "oneYearReturn",
                "3_years": "threeYearReturn",
                "5_years": "fiveYearReturn",
                since_launch: "sinceLaunchReturn",
              };
              const benchMap: Record<FinuerBasketTimePeriod, keyof PerformanceDetail> = {
                "1_month": "benchmarkOneMonth",
                "3_months": "benchmarkThreeMonth",
                "6_months": "benchmarkSixMonth",
                "1_year": "benchmarkOneYear",
                "3_years": "benchmarkThreeYear",
                "5_years": "benchmarkFiveYear",
                since_launch: "benchmarkSinceLaunch",
              };
              const br = p[fieldMap[key]] as number | null;
              const bench = p[benchMap[key]] as number | null;
              return (
                <div key={key} className="finuer-basket-return-cell">
                  <div className="finuer-basket-return-cell-label">{label}</div>
                  <div className="finuer-basket-return-cell-value">{formatReturnPct(br)}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                    Bench {formatReturnPct(bench)}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ margin: "16px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            Returns are calculated automatically from basket holdings and benchmark index data.
          </p>
        </div>
      ) : null}

      {tab === "compare" ? (
        <div className="user-page-card" style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>
            Basket vs {basket.benchmark}
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "8px 4px" }}>Period</th>
                <th style={{ textAlign: "right", padding: "8px 4px" }}>Basket</th>
                <th style={{ textAlign: "right", padding: "8px 4px" }}>Benchmark</th>
                <th style={{ textAlign: "right", padding: "8px 4px" }}>Alpha</th>
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(({ key, label }) => {
                const fieldMap: Record<FinuerBasketTimePeriod, keyof PerformanceDetail> = {
                  "1_month": "oneMonthReturn",
                  "3_months": "threeMonthReturn",
                  "6_months": "sixMonthReturn",
                  "1_year": "oneYearReturn",
                  "3_years": "threeYearReturn",
                  "5_years": "fiveYearReturn",
                  since_launch: "sinceLaunchReturn",
                };
                const benchMap: Record<FinuerBasketTimePeriod, keyof PerformanceDetail> = {
                  "1_month": "benchmarkOneMonth",
                  "3_months": "benchmarkThreeMonth",
                  "6_months": "benchmarkSixMonth",
                  "1_year": "benchmarkOneYear",
                  "3_years": "benchmarkThreeYear",
                  "5_years": "benchmarkFiveYear",
                  since_launch: "benchmarkSinceLaunch",
                };
                const br = p[fieldMap[key]] as number | null;
                const bench = p[benchMap[key]] as number | null;
                const alpha = br != null && bench != null ? br - bench : null;
                return (
                  <tr key={key} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 4px" }}>{label}</td>
                    <td style={{ textAlign: "right", padding: "10px 4px" }}>{formatReturnPct(br)}</td>
                    <td style={{ textAlign: "right", padding: "10px 4px" }}>{formatReturnPct(bench)}</td>
                    <td style={{ textAlign: "right", padding: "10px 4px", fontWeight: 700 }}>{formatReturnPct(alpha)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </UserPageSection>
  );
}
