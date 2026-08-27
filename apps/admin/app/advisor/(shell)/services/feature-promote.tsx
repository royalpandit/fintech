"use client";

import { useEffect, useState } from "react";
import { FiStar } from "react-icons/fi";

type Tier = {
  id: string;
  label: string;
  tagline: string | null;
  priceInr: number;
  durationDays: number;
  badge: string | null;
};

type Status = {
  featured: boolean;
  featuredUntil: string | null;
  tier: string | null;
  daysLeft?: number;
  tiers?: Tier[];
};

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

// Advisors pay to appear as a "Featured Analyst" at the top of Trades.
//
// Tiers and pricing arrive from the API (backed by `sponsorship_tiers`), so
// super-admin can change them without a redeploy — they used to be a hardcoded
// array here, which meant the price on this button was the only place the
// number existed. The card itself is still not charged; the purchase records a
// `payments` row with provider "dev_bypass" until a gateway lands.
export default function FeaturePromote() {
  const [status, setStatus] = useState<Status | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function apply(d: Status | null) {
    if (!d) return;
    setStatus(d);
    if (Array.isArray(d.tiers)) setTiers(d.tiers);
  }

  useEffect(() => {
    fetch("/api/v1/advisor/feature")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && apply(d.data ?? d))
      .catch(() => {});
  }, []);

  async function buy(tier: string) {
    setBusy(tier);
    setError(null);
    try {
      const r = await fetch("/api/v1/advisor/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d?.error ?? "Could not activate the placement.");
        return;
      }
      apply(d.data ?? d);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!confirm("Remove your featured placement?")) return;
    setBusy("cancel");
    try {
      const r = await fetch("/api/v1/advisor/feature", { method: "DELETE" });
      const d = await r.json();
      apply(d.data ?? d);
    } finally {
      setBusy(null);
    }
  }

  const active = status?.featured;

  return (
    <article
      className="card"
      style={{
        marginBottom: 18,
        borderColor: active ? "rgba(245,158,11,0.5)" : "var(--border)",
        background: active
          ? "linear-gradient(135deg, rgba(245,158,11,0.06), var(--surface))"
          : "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <FiStar size={16} style={{ color: "#f59e0b" }} />
        <h3 style={{ margin: 0 }}>Featured Analyst promotion</h3>
        {active && (
          <span
            style={{
              padding: "2px 9px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              background: "rgba(245,158,11,0.16)",
              color: "#b45309",
            }}
          >
            Active
          </span>
        )}
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Get your profile pinned to the top of the <strong>Trades</strong> page and the Featured Analysts
        rail — more visibility, more subscribers.{" "}
        {active
          ? `You're featured until ${fmt(status?.featuredUntil ?? null)}.`
          : "Payment is bypassed while we finish billing integration."}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {tiers.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
            No promotion tiers are available right now.
          </p>
        ) : (
          tiers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => buy(t.id)}
              disabled={busy != null}
              className="btn-primary"
              title={t.tagline ?? undefined}
              style={{
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: busy ? "wait" : "pointer",
                background: "#f59e0b",
              }}
            >
              {busy === t.id
                ? "Activating…"
                : `${active ? "Extend" : "Feature"} · ${t.label} · ${inr(t.priceInr)}`}
              {t.badge ? ` · ${t.badge}` : ""}
            </button>
          ))
        )}
        {active && (
          <button
            type="button"
            onClick={cancel}
            disabled={busy != null}
            style={{
              padding: "9px 12px",
              fontSize: 13,
              border: "none",
              background: "none",
              color: "var(--text-muted)",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy === "cancel" ? "Removing…" : "Remove"}
          </button>
        )}
      </div>

      {error && (
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--danger, #dc2626)" }} role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
