"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SubscribeServiceModal, { type AdvisorServiceCard } from "@/components/subscribe-service-modal";

export default function AdvisorServicesList({
  services,
  advisorName,
}: {
  services: AdvisorServiceCard[];
  advisorName: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<AdvisorServiceCard | null>(null);

  if (services.length === 0) {
    return (
      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Subscription Plans</h3>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
          {advisorName} has not published any subscription services yet.
        </p>
      </article>
    );
  }

  return (
    <>
      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Subscription Plans</h3>
        <p className="page-subtitle" style={{ marginTop: 0, marginBottom: 16 }}>
          Choose a service to get signals, recommendations, and private chat access.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {services.map((s) => (
            <div
              key={s.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                background: "var(--surface-2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 16 }}>{s.name}</strong>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        background: "rgba(14,165,233,0.12)",
                        color: "#0369a1",
                      }}
                    >
                      {s.categoryLabel}
                    </span>
                    {s.isSubscribed && (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          background: "#d1fae5",
                          color: "#047857",
                        }}
                      >
                        Subscribed
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {s.description}
                  </p>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    {s.subscriberCount.toLocaleString()} subscribers · ₹{s.monthlyPrice.toLocaleString("en-IN")}/mo ·
                    ₹{s.yearlyPrice.toLocaleString("en-IN")}/yr
                    {s.yearlySavingsPct > 0 ? ` · Save ${s.yearlySavingsPct}% yearly` : ""}
                  </p>
                  {s.offerFreeTrial && (
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#047857", fontWeight: 600 }}>
                      7-day free trial available
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {s.isSubscribed ? (
                    <span style={{ fontSize: 13, color: "#047857", fontWeight: 600 }}>Active</span>
                  ) : s.canSubscribe ? (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ padding: "10px 18px", fontSize: 13 }}
                      onClick={() => setSelected(s)}
                    >
                      Subscribe
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Not accepting new subs</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>

      {selected && (
        <SubscribeServiceModal
          service={selected}
          onClose={() => setSelected(null)}
          onSubscribed={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
