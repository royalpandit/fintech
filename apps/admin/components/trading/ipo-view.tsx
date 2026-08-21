"use client";

import { useEffect, useState } from "react";

type Ipo = {
  symbol: string;
  company: string;
  status: string;
  openDate: string;
  closeDate: string;
  issuePrice: string;
  issueSize: string;
  gmp: string | null;
};

export default function IpoView() {
  const [rows, setRows] = useState<Ipo[]>([]);
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/market/ipo", { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (j.ok) {
          setRows(j.issues ?? []);
          setProvider(j.provider ?? "");
          setError("");
        } else setError(j.error || "Failed to load IPOs");
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
        Current issues from NSE · grey-market premium from Chittorgarh (IPOWatch failover)
        {provider ? ` · list via ${provider}` : ""}
      </p>
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}
      <article style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "left" }}>
                {["Company", "Symbol", "Status", "Open", "Close", "Price", "GMP"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No current IPOs.</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.symbol}-${i}`} className="mkt-trow" style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)" }}>{r.company || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>{r.symbol || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>{r.status || "—"}</td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{r.openDate || "—"}</td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{r.closeDate || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>{r.issuePrice || "—"}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.gmp || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
