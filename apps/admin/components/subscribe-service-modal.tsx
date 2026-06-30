"use client";

import { useState } from "react";
import { FiX } from "react-icons/fi";
import { yearlySavingsPct } from "@/lib/subscription-services";

type ServicePlan = "monthly" | "yearly";

export type AdvisorServiceCard = {
  id: number;
  name: string;
  categoryLabel: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlySavingsPct: number;
  offerFreeTrial: boolean;
  subscriberCount: number;
  isSubscribed: boolean;
  canSubscribe: boolean;
};

export default function SubscribeServiceModal({
  service,
  onClose,
  onSubscribed,
}: {
  service: AdvisorServiceCard;
  onClose: () => void;
  onSubscribed: () => void;
}) {
  const [subscribing, setSubscribing] = useState<ServicePlan | null>(null);
  const [error, setError] = useState("");

  const savings = service.yearlySavingsPct || yearlySavingsPct(service.monthlyPrice, service.yearlyPrice);

  async function subscribe(plan: ServicePlan) {
    if (subscribing) return;
    setSubscribing(plan);
    setError("");
    try {
      const res = await fetch(`/api/v1/advisor/subscription-services/${service.id}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.ok && data.status !== false) onSubscribed();
      else setError(data.error || "Couldn't subscribe. Please try again.");
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
          maxWidth: 440,
          background: "var(--surface)",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 24px 80px rgba(15,23,42,0.18)",
          color: "var(--text)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{service.name}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          >
            <FiX size={18} />
          </button>
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>
          {service.categoryLabel}
        </p>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {service.description}
        </p>

        {service.offerFreeTrial && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)",
              fontSize: 12,
              color: "#047857",
            }}
          >
            7-day free trial included for new subscribers
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            onClick={() => subscribe("monthly")}
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
              <div style={{ fontWeight: 600, fontSize: 14 }}>Monthly</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0ea5e9", marginTop: 3 }}>
                {service.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {service.categoryLabel} · Billed every month
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#0ea5e9" }}>
              {subscribing === "monthly" ? "…" : `₹${service.monthlyPrice.toLocaleString("en-IN")}/mo`}
            </div>
          </button>

          <button
            type="button"
            onClick={() => subscribe("yearly")}
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
              <div style={{ fontWeight: 600, fontSize: 14 }}>Yearly</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0ea5e9", marginTop: 3 }}>
                {service.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {service.categoryLabel}
                {savings > 0 ? ` · Save ${savings}%` : " · Billed yearly"}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#0ea5e9" }}>
              {subscribing === "yearly" ? "…" : `₹${service.yearlyPrice.toLocaleString("en-IN")}/yr`}
            </div>
          </button>
        </div>

        {error && (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#b91c1c", textAlign: "center" }}>{error}</p>
        )}
        <p style={{ margin: "14px 0 0", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          No payment gateway yet — selecting a plan subscribes you instantly.
        </p>
      </div>
    </div>
  );
}
