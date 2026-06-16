"use client";

import { useState } from "react";
import { FiUserPlus, FiClock, FiUserCheck, FiX } from "react-icons/fi";

type Status = "none" | "pending_sent" | "pending_received" | "accepted";

type Props = {
  targetUserId: number;
  initialStatus: Status;
  size?: "sm" | "md" | "lg";
};

const labels: Record<Status, string> = {
  none: "Connect",
  pending_sent: "Request sent",
  pending_received: "Accept",
  accepted: "Connected",
};

export default function ConnectButton({ targetUserId, initialStatus, size = "md" }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [loading, setLoading] = useState(false);

  const pad = size === "sm" ? "5px 12px" : size === "lg" ? "12px 24px" : "8px 18px";
  const fontSize = size === "sm" ? 11 : size === "lg" ? 15 : 13;

  async function handleClick() {
    if (loading || status === "accepted") return;
    setLoading(true);
    try {
      if (status === "none") {
        const res = await fetch(`/api/v1/users/${targetUserId}/friend-request`, { method: "POST" });
        if (res.ok) setStatus("pending_sent");
      } else if (status === "pending_sent") {
        const res = await fetch(`/api/v1/users/${targetUserId}/friend-request`, { method: "DELETE" });
        if (res.ok) setStatus("none");
      } else if (status === "pending_received") {
        const res = await fetch(`/api/v1/friend-requests/${targetUserId}/accept`, { method: "POST" });
        if (res.ok) setStatus("accepted");
      }
    } finally {
      setLoading(false);
    }
  }

  const icon =
    status === "accepted" ? <FiUserCheck size={13} /> :
    status === "pending_sent" ? <FiClock size={13} /> :
    status === "pending_received" ? <FiUserCheck size={13} /> :
    <FiUserPlus size={13} />;

  const bg =
    status === "accepted" ? "#d1fae5" :
    status === "pending_received" ? "linear-gradient(135deg,#0ea5e9,#10b981)" :
    status === "pending_sent" ? "var(--surface-2)" :
    "rgba(14,165,233,0.1)";

  const color =
    status === "accepted" ? "#047857" :
    status === "pending_received" ? "#fff" :
    status === "pending_sent" ? "var(--text-muted)" :
    "#0ea5e9";

  const border =
    status === "pending_sent" ? "1px solid var(--border)" :
    status === "accepted" ? "1px solid #a7f3d0" :
    "1px solid transparent";

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || status === "accepted"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: pad,
          borderRadius: 10,
          border,
          background: bg,
          color,
          fontSize,
          fontWeight: 700,
          cursor: loading || status === "accepted" ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "all 0.15s",
        }}
      >
        {icon} {labels[status]}
      </button>

      {/* Cancel button for pending_sent */}
      {status === "pending_sent" && !loading && (
        <button
          type="button"
          onClick={handleClick}
          title="Cancel request"
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-muted)",
            padding: "5px 8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          <FiX size={13} />
        </button>
      )}
    </div>
  );
}
