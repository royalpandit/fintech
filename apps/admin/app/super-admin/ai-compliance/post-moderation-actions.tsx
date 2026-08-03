"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";

const btn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
};

export default function PostModerationActions({
  id,
  status,
}: {
  id: number;
  status: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const LABELS: Record<string, string> = {
    approve: "Post approved",
    flag: "Post flagged",
    reject: "Post rejected",
  };

  async function moderate(action: "approve" | "flag" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/v1/admin/posts/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: "Via AI Compliance console" }),
      });
      if (res.ok) {
        show(LABELS[action] ?? "Updated");
        router.refresh();
      } else {
        show("Couldn't update post", "error");
      }
    } catch {
      show("Network error", "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {status !== "approved" && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => moderate("approve")}
          style={{ ...btn, background: "var(--advisor-primary-deep, #047857)", color: "#fff", border: "none" }}
        >
          {loading === "approve" ? "…" : "Approve"}
        </button>
      )}
      {status !== "flagged" && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => moderate("flag")}
          style={{ ...btn, borderColor: "#fde68a", color: "#a16207" }}
        >
          {loading === "flag" ? "…" : "Flag"}
        </button>
      )}
      {status !== "rejected" && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => moderate("reject")}
          style={{ ...btn, borderColor: "#fad2cf", color: "#c5221f" }}
        >
          {loading === "reject" ? "…" : "Reject"}
        </button>
      )}
    </div>
  );
}
