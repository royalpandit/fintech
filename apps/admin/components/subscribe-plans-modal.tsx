"use client";

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { SUB_PLANS, type SubPlanId } from "@/lib/subscription-plans";

type Service = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  yearlyPrice: number | null;
  hasTrial: boolean;
  trialDays: number;
  isBundle: boolean;
};

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
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  // Prefer the advisor's own services (Equity / Commodity / …) when they exist.
  useEffect(() => {
    fetch(`/api/v1/advisor/${advisorId}/services`)
      .then((r) => r.json())
      .then((d) => setServices(d.data ?? []))
      .catch(() => setServices([]));
  }, [advisorId]);

  async function subscribe(opts: { plan?: SubPlanId; serviceId?: number; key: string }) {
    if (subscribing) return;
    setSubscribing(opts.key);
    setError("");
    try {
      const res = await fetch(`/api/v1/advisor/${advisorId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: opts.plan, serviceId: opts.serviceId, billing }),
      });
      if (res.ok) onSubscribed((opts.plan ?? "monthly") as SubPlanId);
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
          background: "var(--surface)",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 24px 80px rgba(15,23,42,0.18)",
          color: "var(--text)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          >
            <FiX size={18} />
          </button>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{subtitle}</p>

        {services.length > 0 && services.some((s) => s.yearlyPrice != null) && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {(["monthly", "yearly"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBilling(b)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: 8,
                  border: billing === b ? "2px solid #0ea5e9" : "1px solid var(--border)",
                  background: billing === b ? "var(--primary-soft)" : "var(--surface)",
                  color: billing === b ? "var(--primary)" : "var(--text)",
                  fontWeight: 700,
                  fontSize: 13,
                  textTransform: "capitalize",
                  cursor: "pointer",
                }}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {services.length > 0
            ? services.map((s) => {
                const showYearly = billing === "yearly" && s.yearlyPrice != null;
                const shownPrice = showYearly ? s.yearlyPrice! : s.price;
                return (
                <button
                  key={`svc-${s.id}`}
                  type="button"
                  onClick={() => subscribe({ serviceId: s.id, key: `svc-${s.id}` })}
                  disabled={subscribing !== null}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    cursor: subscribing ? "wait" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                      {s.name}
                      {s.isBundle && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#7c3aed", background: "rgba(124,58,237,0.12)", padding: "1px 6px", borderRadius: 999 }}>
                          BUNDLE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {s.hasTrial ? `${s.trialDays}-day free trial · ` : ""}
                      {s.description || "Subscription"}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#0ea5e9", flexShrink: 0, textAlign: "right" }}>
                    {subscribing === `svc-${s.id}` ? "…" : `₹${shownPrice.toLocaleString("en-IN")}`}
                    <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)" }}>
                      /{showYearly ? "yr" : "mo"}
                    </div>
                  </div>
                </button>
                );
              })
            : Object.values(SUB_PLANS).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => subscribe({ plan: p.id, key: p.id })}
                  disabled={subscribing !== null}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    cursor: subscribing ? "wait" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {p.id === "yearly" ? "Best value · billed yearly" : "Billed monthly"}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#0ea5e9" }}>
                    {subscribing === p.id ? "…" : `₹${p.price.toLocaleString("en-IN")}`}
                  </div>
                </button>
              ))}
        </div>

        {error && (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#b91c1c", textAlign: "center" }}>{error}</p>
        )}
        <p style={{ margin: "14px 0 0", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          No payment is taken yet — selecting a plan subscribes you instantly.
        </p>
      </div>
    </div>
  );
}
