"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdvisorServicesPickerModal from "@/components/advisor-services-picker-modal";
import SubscribeServiceModal, { type AdvisorServiceCard } from "@/components/subscribe-service-modal";
import SubscribePlansModal from "@/components/subscribe-plans-modal";

export default function SubscribeButton({
  advisorId,
  initialSubscribed,
  services = [],
}: {
  advisorId: number;
  initialSubscribed: boolean;
  services?: AdvisorServiceCard[];
}) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [showPicker, setShowPicker] = useState(false);
  const [singleService, setSingleService] = useState<AdvisorServiceCard | null>(null);
  const [showLegacyPlans, setShowLegacyPlans] = useState(false);
  const [loading, setLoading] = useState(false);

  const availableServices = services.filter((s) => s.canSubscribe && !s.isSubscribed);
  const hasServices = availableServices.length > 0;

  function openSubscribe() {
    if (availableServices.length === 1) {
      setSingleService(availableServices[0]);
      return;
    }
    if (availableServices.length > 1) {
      setShowPicker(true);
      return;
    }
    setShowLegacyPlans(true);
  }

  async function unsubscribe() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/advisor/${advisorId}/subscribe`, { method: "DELETE" });
      if (res.ok) {
        setSubscribed(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={subscribed ? unsubscribe : openSubscribe}
        disabled={loading}
        style={{
          padding: "12px 22px",
          borderRadius: 12,
          background: subscribed ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.95)",
          color: subscribed ? "#fff" : "#064e3b",
          fontWeight: 600,
          fontSize: 14,
          border: subscribed ? "1px solid rgba(255,255,255,0.5)" : "none",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "…" : subscribed ? "✓ Subscribed" : "+ Subscribe"}
      </button>

      {showPicker && (
        <AdvisorServicesPickerModal
          services={services}
          title="Subscribe to a service"
          subtitle="Pick a service — each has its own category, pricing, and benefits."
          onClose={() => setShowPicker(false)}
          onSubscribed={() => {
            setShowPicker(false);
            setSubscribed(true);
            router.refresh();
          }}
        />
      )}

      {singleService && (
        <SubscribeServiceModal
          service={singleService}
          onClose={() => setSingleService(null)}
          onSubscribed={() => {
            setSingleService(null);
            setSubscribed(true);
            router.refresh();
          }}
        />
      )}

      {showLegacyPlans && !hasServices && (
        <SubscribePlansModal
          advisorId={advisorId}
          onClose={() => setShowLegacyPlans(false)}
          onSubscribed={() => {
            setSubscribed(true);
            setShowLegacyPlans(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
