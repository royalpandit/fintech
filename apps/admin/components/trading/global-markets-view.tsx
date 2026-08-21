"use client";

import { useEffect, useState } from "react";
import { FiArrowDownRight, FiArrowUpRight } from "react-icons/fi";

type Index = {
  id: string;
  name: string;
  region: string;
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  currency: string;
};

const fmt = (n: number, currency: string) =>
  n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 2 : 4, style: "decimal" }) +
  (currency && currency !== "USD" ? ` ${currency}` : "");

export default function GlobalMarketsView() {
  const [rows, setRows] = useState<Index[]>([]);
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/market/global", { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (j.ok) {
          setRows(j.indices ?? []);
          setProvider(j.provider ?? "");
          setError("");
        } else setError(j.error || "Failed to load global markets");
      } catch {
        if (alive) setError("Network error");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <section>
      <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--text-muted)" }}>
        US & global indices plus India ADRs · Yahoo Finance primary, Twelve Data failover
        {provider ? ` · via ${provider}` : ""}
      </p>
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {(loading && !rows.length ? Array.from({ length: 7 }, () => null) : rows).map((r, i) => {
          if (!r) return <div key={i} style={{ height: 110, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }} />;
          const pos = r.percentChange >= 0;
          return (
            <article key={r.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>
                {r.region} · {r.symbol}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{r.name}</div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>{fmt(r.price, r.currency)}</div>
              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: pos ? "#16a34a" : "#dc2626", display: "inline-flex", alignItems: "center", gap: 3 }}>
                {pos ? <FiArrowUpRight size={14} /> : <FiArrowDownRight size={14} />}
                {pos ? "+" : ""}
                {r.percentChange.toFixed(2)}%
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
