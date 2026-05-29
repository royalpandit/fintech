"use client";

import type { ReactNode } from "react";
import type { UtilityPanelId } from "./trading-utility-types";

type Item = {
  id: UtilityPanelId;
  label: string;
  icon: ReactNode;
};

const ITEMS: Item[] = [
  {
    id: "watchlist",
    label: "Watchlist",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8M8 12h8M8 15h5" />
      </svg>
    ),
  },
  {
    id: "positions",
    label: "Positions",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    ),
  },
  {
    id: "orders",
    label: "Orders",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    id: "depth",
    label: "Market Depth",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M4 20V10M10 20V4M16 20v-6M22 20V8" />
      </svg>
    ),
  },
  {
    id: "optionChain",
    label: "Option Chain",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    id: "more",
    label: "More",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="19" r="1.5" />
      </svg>
    ),
  },
];

export default function RightUtilityBar({
  active,
  onSelect,
}: {
  active: UtilityPanelId | null;
  onSelect: (id: UtilityPanelId) => void;
}) {
  return (
    <aside className="tt-utility-rail" aria-label="Trading utilities">
      {ITEMS.map(item => (
        <button
          key={item.id}
          type="button"
          className={`tt-utility-rail-btn${active === item.id ? " active" : ""}`}
          onClick={() => onSelect(item.id)}
          title={item.label}
          aria-pressed={active === item.id}
        >
          <span className="tt-utility-rail-icon">{item.icon}</span>
          <span className="tt-utility-rail-label">{item.label}</span>
        </button>
      ))}
    </aside>
  );
}
