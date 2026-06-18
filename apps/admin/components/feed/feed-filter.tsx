"use client";

import { useEffect, useRef, useState } from "react";
import { FiSliders, FiX } from "react-icons/fi";

export type FeedFilters = {
  sort: "latest" | "oldest";
  sentiment: "all" | "bullish" | "bearish" | "neutral";
  asset: "all" | "equity" | "crypto" | "mf" | "commodity" | "other";
  risk: "all" | "low" | "medium" | "high";
  access: "all" | "free" | "paid";
};

export const DEFAULT_FEED_FILTERS: FeedFilters = {
  sort: "latest",
  sentiment: "all",
  asset: "all",
  risk: "all",
  access: "all",
};

const GROUPS: { key: keyof FeedFilters; label: string; options: { id: string; label: string }[] }[] = [
  {
    key: "sort",
    label: "Sort by",
    options: [
      { id: "latest", label: "Latest first" },
      { id: "oldest", label: "Oldest first" },
    ],
  },
  {
    key: "sentiment",
    label: "Direction",
    options: [
      { id: "all", label: "All" },
      { id: "bullish", label: "Bullish" },
      { id: "bearish", label: "Bearish" },
      { id: "neutral", label: "Neutral" },
    ],
  },
  {
    key: "asset",
    label: "Asset type",
    options: [
      { id: "all", label: "All" },
      { id: "equity", label: "Equity" },
      { id: "crypto", label: "Crypto" },
      { id: "mf", label: "Mutual Fund" },
      { id: "commodity", label: "Commodity" },
      { id: "other", label: "Other" },
    ],
  },
  {
    key: "risk",
    label: "Risk",
    options: [
      { id: "all", label: "All" },
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" },
    ],
  },
  {
    key: "access",
    label: "Access",
    options: [
      { id: "all", label: "All" },
      { id: "free", label: "Free" },
      { id: "paid", label: "Paid" },
    ],
  },
];

function countActive(f: FeedFilters): number {
  let n = 0;
  if (f.sort !== "latest") n++;
  if (f.sentiment !== "all") n++;
  if (f.asset !== "all") n++;
  if (f.risk !== "all") n++;
  if (f.access !== "all") n++;
  return n;
}

export default function FeedFilter({
  value,
  onChange,
}: {
  value: FeedFilters;
  onChange: (f: FeedFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = countActive(value);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 14px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: active ? "rgba(14,165,233,0.08)" : "var(--surface)",
          color: active ? "var(--primary)" : "var(--text)",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <FiSliders size={14} /> Filter
        {active > 0 && (
          <span
            style={{
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "#0ea5e9",
              color: "#fff",
              fontSize: 11,
              display: "grid",
              placeItems: "center",
            }}
          >
            {active}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 300,
            maxWidth: "90vw",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14, color: "var(--text)" }}>Filter feed</strong>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FEED_FILTERS)}
              style={{ background: "none", border: "none", color: "#0ea5e9", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Reset
            </button>
          </div>

          <div style={{ display: "grid", gap: 14, maxHeight: "60vh", overflowY: "auto" }}>
            {GROUPS.map((g) => (
              <div key={g.key}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  {g.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {g.options.map((opt) => {
                    const sel = value[g.key] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange({ ...value, [g.key]: opt.id })}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          border: sel ? "1px solid #0ea5e9" : "1px solid var(--border)",
                          background: sel ? "rgba(14,165,233,0.1)" : "var(--surface)",
                          color: sel ? "var(--primary)" : "var(--text)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "10px",
              borderRadius: 10,
              border: "none",
              background: "#0ea5e9",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
