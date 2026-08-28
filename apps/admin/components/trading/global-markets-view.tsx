"use client";

import { useEffect, useMemo, useState } from "react";
import { FiArrowDownRight, FiArrowUpRight, FiSearch, FiX } from "react-icons/fi";

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
  const [query, setQuery] = useState("");

  /* Client-side: the whole set is ~30 indices and already in memory, so a round
     trip per keystroke would be slower and no more accurate. Matches name,
     ticker and region, so "asia", "NIFTY" and "Nikkei" all work. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.symbol.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q),
    );
  }, [rows, query]);

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
      <div style={{ position: "relative", marginBottom: 14, maxWidth: 420 }}>
        <FiSearch
          size={15}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search indices — Nasdaq, Nikkei, Europe…"
          aria-label="Search global indices"
          style={{
            width: "100%",
            height: 38,
            padding: "0 34px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            style={{
              position: "absolute",
              right: 9,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "var(--surface-2)",
              color: "var(--text-muted)",
              width: 20,
              height: 20,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <FiX size={12} />
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {(loading && !rows.length ? Array.from({ length: 7 }, () => null) : filtered).map((r, i) => {
          if (!r) return <div key={i} className="skel" style={{ height: 110, borderRadius: 14 }} />;
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

      {!loading && rows.length > 0 && filtered.length === 0 && (
        <p style={{ margin: "18px 0 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          No index matches &ldquo;{query}&rdquo;.
        </p>
      )}
    </section>
  );
}
