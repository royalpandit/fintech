"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdvisorActions({
  advisorUserId,
  currentStatus,
}: {
  advisorUserId: number;
  currentStatus: "pending" | "approved" | "rejected";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const submit = async (action: "approve" | "reject", rejectionReason?: string) => {
    setLoading(action);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/advisor/${advisorUserId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: rejectionReason }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Action failed");
        setLoading(null);
        return;
      }
      setShowReject(false);
      setReason("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className="input"
          style={{
            width: "auto",
            padding: "12px 16px",
            cursor: currentStatus === "rejected" ? "default" : "pointer",
          }}
          disabled={currentStatus === "rejected" || loading !== null}
          onClick={() => setShowReject(true)}
        >
          {loading === "reject" ? "Rejecting..." : currentStatus === "rejected" ? "Rejected" : "Reject"}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={currentStatus === "approved" || loading !== null}
          onClick={() => submit("approve")}
        >
          {loading === "approve" ? "Approving..." : currentStatus === "approved" ? "Approved" : "Approve"}
        </button>
      </div>

      {showReject && (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            borderRadius: 10,
            width: 320,
          }}
        >
          <p style={{ margin: 0, marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#991b1b" }}>
            Rejection reason
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why (shown to advisor)..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #fca5a5",
              fontSize: 13,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="input"
              style={{ width: "auto", padding: "8px 12px" }}
              onClick={() => {
                setShowReject(false);
                setReason("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: "#dc2626" }}
              disabled={reason.trim().length < 5 || loading !== null}
              onClick={() => submit("reject", reason.trim())}
            >
              Confirm reject
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
