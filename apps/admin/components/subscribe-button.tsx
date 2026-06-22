"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SubscribePlansModal from "@/components/subscribe-plans-modal";

export default function SubscribeButton({
  advisorId,
  initialSubscribed,
}: {
  advisorId: number;
  initialSubscribed: boolean;
}) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [showPlans, setShowPlans] = useState(false);
  const [loading, setLoading] = useState(false);

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
        onClick={subscribed ? unsubscribe : () => setShowPlans(true)}
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

      {showPlans && (
        <SubscribePlansModal
          advisorId={advisorId}
          onClose={() => setShowPlans(false)}
          onSubscribed={() => {
            setSubscribed(true);
            setShowPlans(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
