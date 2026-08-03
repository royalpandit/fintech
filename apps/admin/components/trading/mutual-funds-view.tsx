"use client";

import { useEffect, useState } from "react";

type MutualFund = {
  code: string;
  isin: string;
  name: string;
  amc: string;
  category: string;
  nav: number | null;
  date: string;
};

function cleanCategory(c: string): string {
  // "Open Ended Schemes(Equity Scheme - Flexi Cap Fund)" -> "Equity Scheme - Flexi Cap Fund"
  const m = c.match(/\(([^)]+)\)/);
  return (m ? m[1] : c).trim();
}

const inr = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MutualFundsView() {
  const [q, setQ] = useState("");
  const [funds, setFunds] = useState<MutualFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/market/mutual-funds?q=${encodeURIComponent(q.trim())}`);
        const j = await res.json();
        if (!alive) return;
        if (j.ok || j.status) setFunds(j.funds ?? []);
        else setError(j.error || "Failed to load funds");
      } catch {
        if (alive) setError("Network error");
      } finally {
        if (alive) setLoading(false);
      }
    }, 280);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <section>
      <div style={{ position: "relative", marginBottom: 16, maxWidth: 520 }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search mutual funds by scheme or AMC…"
          style={{
            width: "100%",
            height: 42,
            paddingLeft: 40,
            paddingRight: 14,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--text-muted)" }}>
        NAV data from AMFI (Association of Mutual Funds in India) · updated each business day
      </p>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.3)",
            color: "#92400e",
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <article
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "left" }}>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Scheme</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Category</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>NAV (₹)</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>As of</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
                    Loading funds…
                  </td>
                </tr>
              ) : funds.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
                    No funds matched “{q.trim()}”.
                  </td>
                </tr>
              ) : (
                funds.map((f) => (
                  <tr key={f.code} className="mkt-trow" style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", maxWidth: 420 }}>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{f.name}</div>
                      {f.amc && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{f.amc}</div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", maxWidth: 220 }}>
                      {cleanCategory(f.category)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text)" }}>
                      {f.nav != null ? inr(f.nav) : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {f.date}
                    </td>
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
