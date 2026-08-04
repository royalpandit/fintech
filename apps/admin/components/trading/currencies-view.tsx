"use client";

import { useEffect, useState } from "react";

type Rate = { code: string; name: string; perInr: number; inrValue: number };

export default function CurrenciesView() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <section>
      <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--text-muted)" }}>
        Major currencies vs Indian Rupee · 1 unit in ₹
      </p>
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 92, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }} />
            ))
          : rates.map((r) => (
              <article key={r.code} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{r.code}/INR</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.name}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text)", letterSpacing: -0.5, marginTop: 8 }}>
                  ₹{r.inrValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
              </article>
            ))}
      </div>
    </section>
  );
}
