"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingCards, LoadingInline, LoadingTableRows } from "@/components/loading-shimmer";

type MutualFund = {
  code: string;
  isin: string;
  name: string;
  amc: string;
  category: string;
  plan: string;
  option: string;
  nav: number | null;
  date: string;
};

type Returns = {
  r3m: number | null;
  r6m: number | null;
  r1y: number | null;
  r3y: number | null;
  r5y: number | null;
};

// AMFI now reports Plan and Option as their own columns, so a scheme name on
// its own maps to up to four rows (Direct/Regular x Growth/IDCW) that would
// otherwise look like duplicates.
function planLabel(f: { plan: string; option: string }): string {
  return [f.plan, f.option].filter(Boolean).join(" · ");
}

function cleanCategory(c: string): string {
  const m = c.match(/\(([^)]+)\)/);
  return (m ? m[1] : c).trim();
}

const inr = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SORTS = [
  { key: "name", label: "Name" },
  { key: "r1y", label: "1Y return" },
  { key: "r3y", label: "3Y return" },
  { key: "r5y", label: "5Y return" },
  { key: "r6m", label: "6M return" },
  { key: "r3m", label: "3M return" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

function ReturnCell({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const pos = v >= 0;
  return (
    <span style={{ color: pos ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
      {pos ? "+" : ""}
      {v.toFixed(2)}%
    </span>
  );
}

export default function MutualFundsView() {
  const [q, setQ] = useState("");
  const [funds, setFunds] = useState<MutualFund[]>([]);
  const [returns, setReturns] = useState<Record<string, Returns>>({});
  const [loading, setLoading] = useState(true);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/market/mutual-funds?q=${encodeURIComponent(q.trim())}`);
        const j = await res.json();
        if (!alive) return;
        const list: MutualFund[] = j.ok || j.status ? j.funds ?? [] : [];
        setFunds(list);
        if (!(j.ok || j.status)) setError(j.error || "Failed to load funds");

        // Fetch trailing returns for the visible funds (fast list first, returns fill in).
        const codes = list.map((f) => f.code).slice(0, 50);
        if (codes.length) {
          setReturnsLoading(true);
          fetch(`/api/v1/market/mutual-funds/returns?codes=${codes.join(",")}`)
            .then((r) => r.json())
            .then((rj) => {
              if (alive && (rj.ok || rj.status)) setReturns(rj.returns ?? {});
            })
            .catch(() => {})
            .finally(() => alive && setReturnsLoading(false));
        } else {
          setReturns({});
        }
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

  const sorted = useMemo(() => {
    if (sort === "name") return funds;
    return [...funds].sort((a, b) => {
      const av = returns[a.code]?.[sort] ?? null;
      const bv = returns[b.code]?.[sort] ?? null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av; // high → low
    });
  }, [funds, returns, sort]);

  return (
    <section>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 260, maxWidth: 460 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search mutual funds by scheme or AMC…"
            style={{ width: "100%", height: 42, paddingLeft: 40, paddingRight: 14, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Sort:</span>
          {SORTS.map((s) => {
            const active = s.key === sort;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                  background: active ? "var(--primary-soft, rgba(37,99,235,0.12))" : "var(--surface)",
                  color: active ? "var(--accent-blue, #2563eb)" : "var(--text-muted)",
                }}
              >
                {s.label}
                {active && s.key !== "name" ? " ↓" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--text-muted)" }}>
        NAV from AMFI · returns computed from historical NAV (mfapi.in)
        {returnsLoading ? (
          <>
            {" · "}
            <LoadingInline width={78} height={9} />
          </>
        ) : null}
      </p>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <article style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {/* Desktop: table. Mobile: card list (see .mf-mobile below) so there's
            no horizontal scroll to reach the return columns. */}
        <div className="mf-desktop" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "left" }}>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Scheme</th>
                <th style={{ padding: "12px 16px", fontWeight: 600 }}>Category</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>NAV (₹)</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>3M</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>6M</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>1Y</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>3Y</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>5Y</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingTableRows cols={8} rows={6} />
              ) : sorted.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No funds matched “{q.trim()}”.</td></tr>
              ) : (
                sorted.map((f) => {
                  const ret = returns[f.code];
                  return (
                    <tr key={f.code} className="mkt-trow" style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", maxWidth: 380 }}>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{f.name}</div>
                        {planLabel(f) && (
                          <div style={{ fontSize: 11, color: "var(--text)", opacity: 0.75, marginTop: 2 }}>{planLabel(f)}</div>
                        )}
                        {f.amc && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{f.amc}</div>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)", maxWidth: 200 }}>{cleanCategory(f.category)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--text)" }}>{f.nav != null ? inr(f.nav) : "—"}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}><ReturnCell v={ret?.r3m ?? null} /></td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}><ReturnCell v={ret?.r6m ?? null} /></td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}><ReturnCell v={ret?.r1y ?? null} /></td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}><ReturnCell v={ret?.r3y ?? null} /></td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}><ReturnCell v={ret?.r5y ?? null} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="mf-mobile">
          {loading ? (
            /* Card layout on narrow screens — the table shimmer above would not
               fit here, so cards get card-shaped placeholders. */
            <LoadingCards count={4} height={104} />
          ) : sorted.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No funds matched “{q.trim()}”.</div>
          ) : (
            sorted.map((f) => {
              const ret = returns[f.code];
              return (
                <div key={f.code} className="mf-card">
                  <div className="mf-card-head">
                    <div style={{ minWidth: 0 }}>
                      <div className="mf-card-name">{f.name}</div>
                      {planLabel(f) && <div className="mf-card-amc">{planLabel(f)}</div>}
                      {f.amc && <div className="mf-card-amc">{f.amc}</div>}
                      <div className="mf-card-cat">{cleanCategory(f.category)}</div>
                    </div>
                    <div className="mf-card-nav">
                      <span className="mf-card-nav-label">NAV ₹</span>
                      <span className="mf-card-nav-val">{f.nav != null ? inr(f.nav) : "—"}</span>
                    </div>
                  </div>
                  <div className="mf-card-returns">
                    <div><span>3M</span><ReturnCell v={ret?.r3m ?? null} /></div>
                    <div><span>6M</span><ReturnCell v={ret?.r6m ?? null} /></div>
                    <div><span>1Y</span><ReturnCell v={ret?.r1y ?? null} /></div>
                    <div><span>3Y</span><ReturnCell v={ret?.r3y ?? null} /></div>
                    <div><span>5Y</span><ReturnCell v={ret?.r5y ?? null} /></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </article>
    </section>
  );
}
