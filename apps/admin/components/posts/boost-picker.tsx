"use client";

import { BOOST_TIERS, type BoostTierId } from "@/lib/post-boost";

/**
 * Presentational plan/pricing picker. No payment — selecting a plan just calls
 * onSelect with the tier id (or null for "no boost").
 */
export default function BoostPicker({
  selected,
  onSelect,
  includeNone = true,
}: {
  selected: BoostTierId | null;
  onSelect: (id: BoostTierId | null) => void;
  includeNone?: boolean;
}) {
  const cardStyle = (active: boolean) =>
    ({
      textAlign: "left" as const,
      padding: "12px 14px",
      borderRadius: 12,
      border: active ? "2px solid #0ea5e9" : "1px solid var(--border)",
      background: active ? "rgba(14,165,233,0.12)" : "var(--surface)",
      cursor: "pointer",
    });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
      {includeNone && (
        <button type="button" onClick={() => onSelect(null)} style={cardStyle(selected === null)}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>No boost</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>Free</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Standard reach.</div>
        </button>
      )}
      {BOOST_TIERS.map((t) => {
        const active = selected === t.id;
        return (
          <button key={t.id} type="button" onClick={() => onSelect(t.id)} style={cardStyle(active)}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{t.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0ea5e9", marginTop: 2 }}>
              ₹{t.price.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>{t.blurb}</div>
          </button>
        );
      })}
    </div>
  );
}
