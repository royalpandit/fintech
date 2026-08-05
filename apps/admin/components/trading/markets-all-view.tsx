"use client";

import Link from "next/link";
import { FiArrowUpRight, FiArrowDownRight } from "react-icons/fi";

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
    <Link
      href={chartHref(r)}
      className="mkt-row"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderTop: "1px solid var(--border)", textDecoration: "none", color: "inherit" }}
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
  );
}

function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <Panel title={title} note="coming soon">
      <div style={{ padding: "28px 20px", textAlign: "center" }}>
        <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>{blurb}</p>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 999, background: "var(--surface-2)", color: "var(--text-muted)" }}>
          Needs an exchange / market-data provider
        </span>
      </div>
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

  const empty = <p style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12, margin: 0 }}>Loading…</p>;

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
      <ComingSoon
        title="🧾 Bulk & Block Deals"
        blurb="Large institutional trades reported by the exchanges each day."
      />
      <ComingSoon
        title="🏦 FII / DII Activity"
        blurb="Daily net buy/sell by foreign and domestic institutional investors."
      />
    </div>
  );
}
