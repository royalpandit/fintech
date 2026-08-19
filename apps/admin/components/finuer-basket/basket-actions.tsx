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

  async function copyLink(url: string) {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — nothing useful left to try */
    }
  }

  /**
   * Open the device's share sheet so the link can go to WhatsApp, mail, etc.
   * This used to copy to the clipboard unconditionally, which is the fallback
   * — not the behaviour a Share button should have where the OS provides one.
   */
  async function share() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const title = document.title || "Finuer Basket";

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title,
          text: "Take a look at this basket on Finuer",
          url,
        });
        return;
      } catch (e) {
        // The user dismissing the sheet is not a failure — don't then copy.
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Anything else (unsupported scheme, permission) falls through to copy.
      }
    }

    await copyLink(url);
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
