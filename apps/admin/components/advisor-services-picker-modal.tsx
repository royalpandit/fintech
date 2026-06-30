"use client";

import { useState } from "react";
import { FiX } from "react-icons/fi";
import SubscribeServiceModal, { type AdvisorServiceCard } from "@/components/subscribe-service-modal";

export default function AdvisorServicesPickerModal({
  services,
  title = "Choose a subscription service",
  subtitle = "Select which service you want to subscribe to.",
  onClose,
  onSubscribed,
}: {
  services: AdvisorServiceCard[];
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSubscribed: () => void;
}) {
  const [selected, setSelected] = useState<AdvisorServiceCard | null>(null);
  const available = services.filter((s) => s.canSubscribe && !s.isSubscribed);

  if (selected) {
    return (
      <SubscribeServiceModal
        service={selected}
        onClose={() => setSelected(null)}
        onSubscribed={() => {
          setSelected(null);
          onSubscribed();
        }}
      />
    );
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
          maxWidth: 460,
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
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{subtitle}</p>

        {available.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            No new services available to subscribe right now.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {available.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 600, marginTop: 2 }}>
                    {s.categoryLabel}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    ₹{s.monthlyPrice.toLocaleString("en-IN")}/mo · ₹{s.yearlyPrice.toLocaleString("en-IN")}/yr
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9" }}>Select →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
