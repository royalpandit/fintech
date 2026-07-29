"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiRefreshCw } from "react-icons/fi";

// Renew / cancel a service subscription. Payment is bypassed for now (dev) — the
// API just extends the end date.
export default function SubscriptionActions({
  subscriptionId,
  active,
  kind = "service",
}: {
  subscriptionId: number;
  active: boolean;
  kind?: "service" | "advisor";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"renew" | "cancel" | null>(null);
  const qs = kind === "advisor" ? "?kind=advisor" : "";

  async function renew(billing: "monthly" | "yearly") {
    setBusy("renew");
    try {
      await fetch(`/api/v1/user/subscriptions/${subscriptionId}/renew${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!confirm("Cancel this subscription? You keep access until it expires.")) return;
    setBusy("cancel");
    try {
      await fetch(`/api/v1/user/subscriptions/${subscriptionId}/renew${qs}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => renew("monthly")}
        disabled={busy != null}
        className="btn-primary"
        style={{ padding: "10px 20px", fontSize: 13.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7, cursor: busy ? "wait" : "pointer" }}
      >
        <FiRefreshCw size={15} /> {busy === "renew" ? "Renewing…" : "Renew · 1 month"}
      </button>
      <button
        type="button"
        onClick={() => renew("yearly")}
        disabled={busy != null}
        style={{ padding: "10px 14px", fontSize: 13, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: busy ? "wait" : "pointer", fontWeight: 600 }}
      >
        Renew · 1 year
      </button>
      {active && (
        <button
          type="button"
          onClick={cancel}
          disabled={busy != null}
          style={{ padding: "10px 12px", fontSize: 13, border: "none", background: "none", color: "var(--text-muted)", cursor: busy ? "wait" : "pointer" }}
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      )}
    </div>
  );
}
