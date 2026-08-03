"use client";

import { useEffect, useState } from "react";
import { FiStar, FiShare2, FiCheck } from "react-icons/fi";

// Basket detail actions: Add to Watchlist (toggle) + Share (copy link).
export default function BasketActions({ basketId }: { basketId: number }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/baskets/${basketId}/save`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setSaved(Boolean(j.saved)))
      .catch(() => {});
  }, [basketId]);

  async function toggleSave() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/baskets/${basketId}/save`, {
        method: saved ? "DELETE" : "POST",
        credentials: "include",
      });
      const j = await res.json();
      if (res.ok) setSaved(Boolean(j.saved));
      else if (res.status === 401) alert("Sign in to save baskets");
    } finally {
      setBusy(false);
    }
  }

  function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      });
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={toggleSave}
        disabled={busy}
        className="mkt-add-wl"
        style={saved ? { background: "var(--primary-soft)", borderColor: "var(--primary)" } : undefined}
      >
        <FiStar size={15} style={{ fill: saved ? "currentColor" : "none" }} />
        {saved ? "Saved" : "Add to Watchlist"}
      </button>
      <button type="button" onClick={share} className="mkt-add-wl">
        {copied ? <FiCheck size={15} /> : <FiShare2 size={15} />}
        {copied ? "Copied!" : "Share"}
      </button>
    </div>
  );
}
