"use client";

import { useState } from "react";
import { FiStar } from "react-icons/fi";

// Compact "add basket to watchlist" star for grid cards (save-only + stops the
// card's link navigation).
export default function BasketCardWatchButton({ basketId }: { basketId: number }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saved || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/baskets/${basketId}/save`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) setSaved(true);
      else if (res.status === 401) alert("Sign in to save baskets");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      title={saved ? "Saved to watchlist" : "Add to watchlist"}
      aria-label="Add to watchlist"
      className="mkt-add-wl mkt-add-wl-compact"
      style={saved ? { color: "var(--primary)", background: "var(--primary-soft)", borderColor: "var(--primary)" } : undefined}
    >
      <FiStar size={15} style={{ fill: saved ? "currentColor" : "none" }} />
    </button>
  );
}
