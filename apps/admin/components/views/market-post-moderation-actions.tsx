"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "approve" | "flag" | "reject";

export default function PostModerationActions({
  postId,
  currentStatus,
}: {
  postId: number;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [notesOpen, setNotesOpen] = useState<Action | null>(null);
  const [notes, setNotes] = useState("");

  const submit = async (action: Action, moderationNotes?: string) => {
    setLoading(action);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/posts/${postId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: moderationNotes }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Action failed");
        setLoading(null);
        return;
      }
      setNotesOpen(null);
      setNotes("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className="input"
          style={{ width: "auto", padding: "10px 14px", fontWeight: 700 }}
          disabled={loading !== null || currentStatus === "flagged"}
          onClick={() => setNotesOpen("flag")}
        >
          {loading === "flag" ? "Flagging..." : currentStatus === "flagged" ? "Flagged" : "Flag"}
        </button>
        <button
          type="button"
          className="btn-primary"
          style={{ padding: "10px 14px" }}
          disabled={loading !== null || currentStatus === "approved"}
          onClick={() => submit("approve")}
        >
          {loading === "approve" ? "Approving..." : currentStatus === "approved" ? "Approved" : "Approve"}
        </button>
        <button
          type="button"
          style={{
            borderRadius: 12,
            border: 0,
            background: currentStatus === "rejected" ? "#94a3b8" : "#be2026",
            color: "#fff",
            padding: "10px 16px",
            fontWeight: 700,
            cursor: currentStatus === "rejected" ? "default" : "pointer",
          }}
          disabled={loading !== null || currentStatus === "rejected"}
          onClick={() => setNotesOpen("reject")}
        >
          {loading === "reject" ? "Rejecting..." : currentStatus === "rejected" ? "Rejected" : "Reject"}
        </button>
      </div>

      {notesOpen && (
        <div
          style={{
            padding: 12,
            border: "1px solid var(--border)",
            background: "#fff",
            borderRadius: 12,
            width: 360,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
          }}
        >
          <p style={{ margin: 0, marginBottom: 6, fontWeight: 700, fontSize: 14 }}>
            {notesOpen === "flag" ? "Flag reason" : "Rejection reason"}
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Explain your decision (stored in compliance log)..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid var(--border)",
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
                setNotesOpen(null);
                setNotes("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: notesOpen === "reject" ? "#dc2626" : "#d97706" }}
              disabled={notes.trim().length < 3 || loading !== null}
              onClick={() => submit(notesOpen, notes.trim())}
            >
              Confirm {notesOpen}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
