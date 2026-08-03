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

export default function CourseRowActions({
  id,
  complianceStatus,
  isPublished,
}: {
  id: number;
  complianceStatus: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const LABELS: Record<string, string> = {
    approve: "Course approved",
    reject: "Course rejected",
    publish: "Course visibility updated",
  };

  async function patch(body: Record<string, unknown>, key: string) {
    setLoading(key);
    try {
      const res = await fetch(`/api/v1/admin/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        show(LABELS[key] ?? "Updated");
        router.refresh();
      } else {
        show("Couldn't update course", "error");
      }
    } catch {
      show("Network error", "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {complianceStatus !== "approved" && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => patch({ complianceStatus: "approved" }, "approve")}
          style={{ ...btn, background: "var(--advisor-primary-deep, #047857)", color: "#fff", border: "none" }}
        >
          {loading === "approve" ? "…" : "Approve"}
        </button>
      )}
      {complianceStatus !== "rejected" && (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => patch({ complianceStatus: "rejected" }, "reject")}
          style={{ ...btn, borderColor: "#fad2cf", color: "#c5221f" }}
        >
          {loading === "reject" ? "…" : "Reject"}
        </button>
      )}
      <button
        type="button"
        disabled={loading !== null}
        onClick={() => patch({ isPublished: !isPublished }, "publish")}
        style={btn}
      >
        {loading === "publish" ? "…" : isPublished ? "Unpublish" : "Publish"}
      </button>
    </div>
  );
}
