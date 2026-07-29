"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiMessageCircle } from "react-icons/fi";
import AdvisorServicesPickerModal from "@/components/advisor-services-picker-modal";
import SubscribeServiceModal, { type AdvisorServiceCard } from "@/components/subscribe-service-modal";
import SubscribePlansModal from "@/components/subscribe-plans-modal";

type Props = {
  advisorId: number;
  isFollowing?: boolean;
  services?: AdvisorServiceCard[];
};

export default function MessageAdvisorButton({ advisorId, services = [] }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [singleService, setSingleService] = useState<AdvisorServiceCard | null>(null);
  const [showLegacyPlans, setShowLegacyPlans] = useState(false);
  const [error, setError] = useState("");

  const availableServices = services.filter((s) => s.canSubscribe && !s.isSubscribed);
  const hasServices = availableServices.length > 0;

  async function tryOpenChat(): Promise<"ok" | "gated" | "error"> {
    try {
      const res = await fetch("/api/v1/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: advisorId }),
      });
      if (res.status === 403) return "gated";
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.threadId) {
        router.push(`/user/messages/${json.threadId}`);
        return "ok";
      }
      return "error";
    } catch {
      return "error";
    }
  }

  function openSubscribeFlow() {
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

  async function onMessage() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await tryOpenChat();
      if (result === "gated") openSubscribeFlow();
      else if (result === "error") setError("Couldn't open chat. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubscribed() {
    setShowPicker(false);
    setSingleService(null);
    setShowLegacyPlans(false);
    router.refresh();
    await tryOpenChat();
  }

  return (
    <>
      <button
        type="button"
        onClick={onMessage}
        disabled={loading}
        title="Send a message"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "12px 22px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.3)",
          background: "rgba(255,255,255,0.12)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <FiMessageCircle size={15} />
        {loading ? "Opening…" : "Message"}
      </button>

      {error && (
        <div
          role="alert"
          onClick={() => setError("")}
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            padding: "10px 16px",
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid rgba(239,68,68,0.30)",
            color: "#b91c1c",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 12px 40px rgba(15,23,42,0.14)",
            cursor: "pointer",
          }}
        >
          {error}
        </div>
      )}

      {showPicker && (
        <AdvisorServicesPickerModal
          services={services}
          title="Subscribe to chat"
          subtitle="Subscribe to a service to message this advisor and get subscriber-only posts."
          onClose={() => setShowPicker(false)}
          onSubscribed={onSubscribed}
        />
      )}

      {singleService && (
        <SubscribeServiceModal
          service={singleService}
          onClose={() => setSingleService(null)}
          onSubscribed={onSubscribed}
        />
      )}

      {showLegacyPlans && !hasServices && (
        <SubscribePlansModal
          advisorId={advisorId}
          title="Subscribe to chat"
          subtitle="Subscribe to message this advisor directly — you'll also get their subscriber-only posts."
          onClose={() => setShowLegacyPlans(false)}
          onSubscribed={onSubscribed}
        />
      )}
    </>
  );
}
