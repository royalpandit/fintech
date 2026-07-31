"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FiSearch, FiX, FiSliders } from "react-icons/fi";
import SubscriptionActions from "@/components/subscriptions/subscription-actions";

export type SubRow = {
  key: string;
  kind: "service" | "advisor";
  id: number;
  title: string;
  advisorName: string;
  advisorId: number | null;
  meta: string;
  description: string | null;
  active: boolean;
  status: string;
  expText: string;
  expTone: "muted" | "soon" | "expired";
  showExp: boolean;
};

export type PurchaseRow = {
  id: number;
  title: string;
  advisorName: string;
  marketSymbol: string | null;
  unlockedAt: string;
  priceText: string;
};

type StatusFilter = "all" | "active" | "expired" | "cancelled";
type KindFilter = "all" | "service" | "advisor" | "purchase";

const STATUS_OPTS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
  { id: "cancelled", label: "Cancelled" },
];
const KIND_OPTS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "service", label: "Services" },
  { id: "advisor", label: "Advisor plans" },
  { id: "purchase", label: "One-time" },
];

const expColor = (tone: SubRow["expTone"]) =>
  tone === "expired" ? "#64748b" : tone === "soon" ? "#b45309" : "var(--text-muted)";

export default function SubscriptionsBrowser({
  subs,
  purchases,
}: {
  subs: SubRow[];
  purchases: PurchaseRow[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const activeFilters = (status !== "all" ? 1 : 0) + (kind !== "all" ? 1 : 0);

  const query = q.trim().toLowerCase();
  const matches = (hay: string) => hay.toLowerCase().includes(query);

  const visibleSubs = useMemo(() => {
    if (kind === "purchase") return [];
    return subs.filter((s) => {
      if (kind === "service" && s.kind !== "service") return false;
      if (kind === "advisor" && s.kind !== "advisor") return false;
      if (status === "active" && !s.active) return false;
      if (status === "expired" && s.expTone !== "expired") return false;
      if (status === "cancelled" && s.status !== "cancelled") return false;
      if (query && !matches(`${s.title} ${s.advisorName} ${s.meta} ${s.description ?? ""}`)) return false;
      return true;
    });
  }, [subs, kind, status, query]);

  const visiblePurchases = useMemo(() => {
    // One-time purchases have no active/expired/cancelled state, so any status
    // filter other than "all" hides them.
    if (kind === "service" || kind === "advisor") return [];
    if (status !== "all") return [];
    return purchases.filter(
      (p) => !query || matches(`${p.title} ${p.advisorName} ${p.marketSymbol ?? ""}`),
    );
  }, [purchases, kind, status, query]);

  const nothing = visibleSubs.length === 0 && visiblePurchases.length === 0;

  return (
    <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
      {/* Toolbar: search + filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 260px", minWidth: 0 }}>
          <FiSearch
            size={15}
            style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subscriptions & purchases…"
            style={{
              width: "100%",
              padding: "10px 38px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13,
              outline: "none",
            }}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear"
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "var(--surface-2)", color: "var(--text-muted)", width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer" }}
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: activeFilters ? "var(--primary-soft)" : "var(--surface)",
              color: activeFilters ? "var(--primary)" : "var(--text)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <FiSliders size={14} /> Filter
            {activeFilters > 0 && (
              <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--primary)", color: "#fff", fontSize: 11, display: "grid", placeItems: "center" }}>
                {activeFilters}
              </span>
            )}
          </button>

          {filterOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                width: 240,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                boxShadow: "0 16px 44px rgba(0,0,0,0.18)",
                zIndex: 40,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ fontSize: 13, color: "var(--text)" }}>Filter</strong>
                {activeFilters > 0 && (
                  <button
                    type="button"
                    onClick={() => { setStatus("all"); setKind("all"); }}
                    style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Status
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {STATUS_OPTS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setStatus(o.id)}
                    style={pill(status === o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                Type
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {KIND_OPTS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setKind(o.id)}
                    style={pill(kind === o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subscriptions */}
      {visibleSubs.length > 0 && (
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Active &amp; past subscriptions</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {visibleSubs.map((s) => (
              <div
                key={s.key}
                style={{
                  border: `1px solid ${s.expTone === "soon" && s.active ? "#f59e0b" : "var(--border)"}`,
                  borderRadius: 12,
                  padding: 14,
                  background: "var(--surface-2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{s.title}</strong>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      {s.kind === "advisor" && s.advisorId ? (
                        <Link href={`/user/advisors/${s.advisorId}`} style={{ color: "#0ea5e9" }}>
                          {s.advisorName}
                        </Link>
                      ) : (
                        s.advisorName
                      )}
                      {s.meta ? ` · ${s.meta}` : ""}
                    </div>
                    {s.description && (
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {s.description}
                      </p>
                    )}
                    <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: expColor(s.expTone) }}>
                      {s.showExp ? s.expText : ""}
                    </div>
                  </div>
                  <span
                    style={{
                      alignSelf: "flex-start",
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: s.active ? "#d1fae5" : "#f1f5f9",
                      color: s.active ? "#047857" : "#64748b",
                    }}
                  >
                    {s.active ? "Active" : s.status}
                  </span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <SubscriptionActions subscriptionId={s.id} active={s.active} kind={s.kind} />
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      {/* One-time purchases */}
      {visiblePurchases.length > 0 && (
        <article className="card">
          <h3 style={{ marginTop: 0 }}>One-time purchases</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {visiblePurchases.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Link href="/user/trades" style={{ fontWeight: 600, color: "var(--text)" }}>
                    {p.title}
                  </Link>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {p.advisorName}
                    {p.marketSymbol ? ` · ${p.marketSymbol}` : ""}
                    {" · unlocked "}
                    {p.unlockedAt}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#047857", whiteSpace: "nowrap" }}>
                  {p.priceText}
                </span>
              </div>
            ))}
          </div>
        </article>
      )}

      {nothing && (
        <article className="card" style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {q || activeFilters > 0
            ? "No subscriptions or purchases match your search."
            : "You haven't subscribed to any plan or unlocked any trade yet."}
        </article>
      )}
    </div>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
    background: active ? "var(--primary-soft)" : "var(--surface)",
    color: active ? "var(--primary)" : "var(--text)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}
