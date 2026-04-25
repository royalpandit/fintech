"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Pending = {
  userId: number;
  fullName: string;
  sebiId: string;
  submittedAt: string;
};

export default function QuickAction({ topPending }: { topPending: Pending[] }) {
  const router = useRouter();
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [selectedId, setSelectedId] = useState<number | null>(
    topPending[0]?.userId ?? null,
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async () => {
    if (!selectedId) {
      setError("Pick an advisor first");
      return;
    }
    if (action === "reject" && reason.trim().length < 5) {
      setError("Reason required for rejection (min 5 chars)");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`/api/v1/admin/advisor/${selectedId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "reject" ? reason.trim() : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Action failed");
        setLoading(false);
        return;
      }
      setSuccess(`Advisor ${action === "approve" ? "approved" : "rejected"}.`);
      setReason("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="widget">
      <div className="widget-title">
        <h3>Quick Verify</h3>
        <Link href="/admin/advisors">View queue</Link>
      </div>

      {topPending.length === 0 ? (
        <p
          style={{
            margin: 0,
            textAlign: "center",
            padding: 24,
            color: "#94a3b8",
            fontSize: 12,
          }}
        >
          ✓ Verification queue is empty.
        </p>
      ) : (
        <>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748b",
              display: "block",
              marginBottom: 4,
            }}
          >
            Advisor
          </label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            style={{
              width: "100%",
              height: 38,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid #eef0f4",
              background: "#fff",
              fontSize: 12,
              color: "#334155",
              outline: "none",
              marginBottom: 12,
            }}
          >
            {topPending.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.fullName} — {p.sebiId}
              </option>
            ))}
          </select>

          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748b",
              display: "block",
              marginBottom: 4,
            }}
          >
            Decision
          </label>
          <div className="bs-toggle" style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setAction("approve")}
              className={`bs-toggle-item buy ${action === "approve" ? "active" : ""}`}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setAction("reject")}
              className={`bs-toggle-item sell ${action === "reject" ? "active" : ""}`}
            >
              Reject
            </button>
          </div>

          {action === "reject" && (
            <>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Shown to advisor"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #eef0f4",
                  background: "#fff",
                  fontSize: 12,
                  color: "#334155",
                  outline: "none",
                  marginBottom: 12,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </>
          )}

          {error && (
            <div
              style={{
                padding: "8px 10px",
                background: "#fef2f2",
                color: "#b91c1c",
                borderRadius: 8,
                fontSize: 11,
                marginBottom: 10,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: "8px 10px",
                background: "#f0fdf4",
                color: "#047857",
                borderRadius: 8,
                fontSize: 11,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {success}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="cta-place"
            style={{
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
              background: action === "reject" ? "#dc2626" : "#16a34a",
            }}
          >
            {loading
              ? "Processing..."
              : action === "approve"
                ? "Approve Advisor"
                : "Reject Advisor"}
          </button>
        </>
      )}
    </article>
  );
}
