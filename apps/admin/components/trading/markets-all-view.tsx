"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiArrowUpRight, FiArrowDownRight } from "react-icons/fi";
import TradeButtons from "@/components/trading/trade-buttons";
import { LoadingRows } from "@/components/loading-shimmer";

export type MarketRow = {
  symbol: string;
  token: string;
  exchange: string;
  type: string;
  ltp: number;
  netChange: number;
  percentChange: number;
  week52High: number | null;
  week52Low: number | null;
};

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function chartHref(r: MarketRow) {
  const p = new URLSearchParams({ symbol: r.symbol, token: r.token, exchange: r.exchange, type: r.type });
  return `/user/markets/chart?${p.toString()}`;
}

function Panel({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <article style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{title}</h3>
        {note && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{note}</span>}
      </div>
      {children}
    </article>
  );
}

function StockRow({ r }: { r: MarketRow }) {
  const pos = r.percentChange >= 0;
  return (
    <div className="mkt-row" style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)" }}>
      <Link
        href={chartHref(r)}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 4px 11px 16px", textDecoration: "none", color: "inherit" }}
      >
        <span style={{ fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{r.symbol}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--text)", fontSize: 13 }}>₹{inr(r.ltp)}</span>
          <span style={{ color: pos ? "#16a34a" : "#dc2626", fontWeight: 600, fontSize: 13, minWidth: 70, textAlign: "right", display: "inline-flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
            {pos ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
            {pos ? "+" : ""}{r.percentChange.toFixed(2)}%
          </span>
        </span>
      </Link>
      {/* Hidden automatically for anything the paper engine can't fill. */}
      <span style={{ paddingRight: 12, flexShrink: 0 }}>
        <TradeButtons symbol={r.symbol} instrumentType={r.type} exchange={r.exchange} />
      </span>
    </div>
  );
}

type FiiRow = { date: string; category: string; buyValue: number; sellValue: number; netValue: number };
type DealRow = { date: string; symbol: string; name: string; client: string; buySell: string; quantity: number; avgPrice: number; dealType: string };

function FiiDiiPanel() {
  const [rows, setRows] = useState<FiiRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/market/fii-dii", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.ok) setRows(j.rows ?? []);
        else setError(j.error || "Unavailable");
      })
      .catch(() => alive && setError("Network error"));
    return () => {
      alive = false;
    };
  }, []);
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return (
    <Panel title="🏦 FII / DII Activity" note="NSE after close">
      {error && !rows.length ? (
        <p style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12, margin: 0 }}>{error}</p>
      ) : !rows.length ? (
        <div style={{ padding: 16 }}><LoadingRows rows={4} /></div>
      ) : (
        rows.slice(0, 8).map((r, i) => {
          const pos = r.netValue >= 0;
          return (
            <div key={`${r.category}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 16px", borderTop: i ? "1px solid var(--border)" : undefined, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{r.category || "—"}</span>
              <span style={{ color: pos ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                {pos ? "+" : ""}₹{fmt(r.netValue)} Cr
              </span>
            </div>
          );
        })
      )}
    </Panel>
  );
}

function BulkDealsPanel() {
  const [rows, setRows] = useState<DealRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/market/bulk-deals", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.ok) setRows(j.rows ?? []);
        else setError(j.error || "Unavailable");
      })
      .catch(() => alive && setError("Network error"));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Panel title="🧾 Bulk & Block Deals" note="NSE">
      {error && !rows.length ? (
        <p style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12, margin: 0 }}>{error}</p>
      ) : !rows.length ? (
        <div style={{ padding: 16 }}><LoadingRows rows={4} /></div>
      ) : (
        rows.slice(0, 8).map((r, i) => (
          <div key={`${r.symbol}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 16px", borderTop: i ? "1px solid var(--border)" : undefined, fontSize: 13 }}>
            <span>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>{r.symbol}</span>
              <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>{r.buySell}</span>
            </span>
            <span style={{ color: "var(--text-muted)" }}>{r.quantity.toLocaleString("en-IN")}</span>
          </div>
        ))
      )}
    </Panel>
  );
}

export default function MarketsAllView({ stocks }: { stocks: MarketRow[] }) {
  const trending = [...stocks].sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)).slice(0, 5);
  const nearHigh = stocks
    .filter((s) => s.week52High && s.ltp)
    .sort((a, b) => b.ltp / (b.week52High || 1) - a.ltp / (a.week52High || 1))
    .slice(0, 5);
  const nearLow = stocks
    .filter((s) => s.week52Low && s.ltp)
    .sort((a, b) => a.ltp / (a.week52Low || 1) - b.ltp / (b.week52Low || 1))
    .slice(0, 5);

  const empty = <div style={{ padding: 16 }}><LoadingRows rows={4} /></div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
      <Panel title="🔥 Trending Stocks" note="most active by % move">
        {trending.length ? trending.map((r) => <StockRow key={r.token} r={r} />) : empty}
      </Panel>
      <Panel title="📈 Near 52-Week High" note="top 5">
        {nearHigh.length ? nearHigh.map((r) => <StockRow key={r.token} r={r} />) : empty}
      </Panel>
      <Panel title="📉 Near 52-Week Low" note="top 5">
        {nearLow.length ? nearLow.map((r) => <StockRow key={r.token} r={r} />) : empty}
      </Panel>
      <BulkDealsPanel />
      <FiiDiiPanel />
    </div>
  );
}
