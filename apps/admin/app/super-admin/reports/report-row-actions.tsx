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

export default function ReportRowActions({
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
    resolved: "Report resolved",
    dismissed: "Report dismissed",
    open: "Report re-opened",
  };

  async function set(next: string) {
    setLoading(next);
    try {
      const res = await fetch(`/api/v1/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        show(LABELS[next] ?? "Updated");
        router.refresh();
      } else {
        show("Couldn't update report", "error");
      }
    } catch {
      show("Network error", "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      {status !== "resolved" && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => set("resolved")}
          style={{ ...btn, background: "var(--advisor-primary-deep, #047857)", color: "#fff", border: "none" }}
        >
          {loading === "resolved" ? "…" : "Resolve"}
        </button>
      )}
      {status !== "dismissed" && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => set("dismissed")}
          style={btn}
        >
          {loading === "dismissed" ? "…" : "Dismiss"}
        </button>
      )}
      {status !== "open" && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => set("open")}
          style={btn}
        >
          {loading === "open" ? "…" : "Re-open"}
        </button>
      )}
    </div>
  );
}
