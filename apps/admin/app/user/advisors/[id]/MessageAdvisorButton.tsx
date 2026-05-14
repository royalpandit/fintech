"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiMessageCircle } from "react-icons/fi";

type Props = { advisorId: number; isFollowing: boolean };

export default function MessageAdvisorButton({ advisorId, isFollowing }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function openChat() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: advisorId }),
      });
      const json = await res.json();
      if (res.ok && json.threadId) {
        router.push(`/user/messages/${json.threadId}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={openChat}
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
  );
}
