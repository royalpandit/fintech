"use client";

import { useEffect, useMemo, useState } from "react";
import { FiArrowDownRight, FiArrowUpRight, FiSearch, FiX } from "react-icons/fi";

type Rate = {
  code: string;
  name: string;
  perInr: number;
  inrValue: number;
  changePct: number | null;
};

export default function CurrenciesView() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [meta, setMeta] = useState<{ source?: string; fetchedAt?: string; stale?: boolean }>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/market/currencies");
        const j = await res.json();
        if (!alive) return;
        if ((j.ok || j.status) && j.rates) {
          setRates(j.rates);
          setMeta({ source: j.source, fetchedAt: j.fetchedAt, stale: j.stale });
          setError("");
        } else setError(j.error || "Failed to load currencies");
      } catch {
        if (alive) setError("Network error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Matches the ISO code ("USD", "usd/inr") and the display name ("Dollar").
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/\s*\/\s*inr$/, "");
    if (!needle) return rates;
    return rates.filter(
      (r) => r.code.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle),
    );
  }, [rates, q]);

  const query = q.trim();

  return (
    <section>
      <div className="mkt-toolbar">
        <p className="mkt-toolbar-blurb">
          Live FX vs Indian Rupee · 1 unit in ₹
          {meta.source ? ` · ${meta.source}` : ""}
          {meta.fetchedAt
            ? ` · updated ${new Date(meta.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
            : ""}
          {meta.stale ? " · showing last known rates" : ""}
        </p>
        <div className="mkt-search">
          <FiSearch size={15} className="mkt-search-icon" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search currency (USD, Yen…)"
            aria-label="Search currencies"
          />
          {query && (
            <button
              type="button"
              className="mkt-search-clear"
              onClick={() => setQ("")}
              aria-label="Clear search"
            >
              <FiX size={13} />
            </button>
          )}
        </div>
        {!loading && (
          <span className="mkt-count">
            {query ? `${filtered.length} of ${rates.length}` : `${rates.length} currencies`}
          </span>
        )}
      </div>
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))", gap: 12 }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 92, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }} />
            ))
          : filtered.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No currencies matched “{query}”.
              </div>
            )
          : filtered.map((r) => (
              <article key={r.code} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{r.code}/INR</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.name}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text)", letterSpacing: -0.5, marginTop: 8 }}>
                  ₹{r.inrValue.toLocaleString("en-IN", { maximumFractionDigits: r.inrValue < 1 ? 4 : 2 })}
                </div>
                {/* Only the majors get a day change — er-api has no previous
                    close, so it comes from Yahoo and isn't always available. */}
                {r.changePct != null ? (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      color: r.changePct >= 0 ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {r.changePct >= 0 ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
                    {r.changePct >= 0 ? "+" : ""}
                    {r.changePct.toFixed(2)}%
                  </div>
                ) : null}
              </article>
            ))}
      </div>
    </section>
  );
}
