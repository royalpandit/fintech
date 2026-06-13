"use client";

import { useState } from "react";
import { FiX } from "react-icons/fi";
import { SUB_PLANS, type SubPlanId } from "@/lib/subscription-plans";

/**
 * Shared monthly/yearly plan picker. One paid subscription unlocks both the
 * advisor's subscriber-only posts and 1-on-1 chat. No payment is processed —
 * selecting a plan subscribes the user.
 */
export default function SubscribePlansModal({
  advisorId,
  title = "Subscribe",
  subtitle = "Get this advisor's subscriber-only posts and 1-on-1 chat.",
  onClose,
  onSubscribed,
}: {
  advisorId: number;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSubscribed: (plan: SubPlanId) => void;
}) {
  const [subscribing, setSubscribing] = useState<SubPlanId | null>(null);
  const [error, setError] = useState("");

  async function subscribe(plan: SubPlanId) {
    if (subscribing) return;
    setSubscribing(plan);
    setError("");
    try {
      const res = await fetch(`/api/v1/advisor/${advisorId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.ok) onSubscribed(plan);
      else setError("Couldn't subscribe. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubscribing(null);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 24px 80px rgba(15,23,42,0.18)",
          color: "#0f172a",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
          >
            <FiX size={18} />
          </button>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{subtitle}</p>

        <div style={{ display: "grid", gap: 10 }}>
          {Object.values(SUB_PLANS).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => subscribe(p.id)}
              disabled={subscribing !== null}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "#fff",
                cursor: subscribing ? "wait" : "pointer",
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{p.label}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {p.id === "yearly" ? "Best value · billed yearly" : "Billed monthly"}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0ea5e9" }}>
                {subscribing === p.id ? "…" : `₹${p.price.toLocaleString("en-IN")}`}
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#b91c1c", textAlign: "center" }}>{error}</p>
        )}
        <p style={{ margin: "14px 0 0", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
          No payment is taken yet — selecting a plan subscribes you instantly.
        </p>
      </div>
    </div>
  );
}
