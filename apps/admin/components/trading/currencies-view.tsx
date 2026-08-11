"use client";

import { useEffect, useMemo, useState } from "react";

type Rate = { code: string; name: string; perInr: number; inrValue: number };

export default function CurrenciesView() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/market/currencies");
        const j = await res.json();
        if (!alive) return;
        if ((j.ok || j.status) && j.rates) {
          setRates(j.rates);
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rates;
    return rates.filter(
      (r) => r.code.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle),
    );
  }, [rates, q]);

  return (
    <section>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <p style={{ margin: 0, flex: 1, fontSize: 11.5, color: "var(--text-muted)" }}>
          Live FX vs Indian Rupee · pairs from open.er-api.com · 1 unit in ₹
          {!loading ? ` · ${rates.length} currencies` : ""}
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search currency…"
          style={{
            height: 36,
            minWidth: 180,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
      </div>
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 92, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }} />
            ))
          : filtered.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No currencies matched “{q.trim()}”.
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
              </article>
            ))}
      </div>
    </section>
  );
}
