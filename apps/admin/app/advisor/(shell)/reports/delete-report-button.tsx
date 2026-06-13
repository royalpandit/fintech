"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteReportButton({ id }: { id: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    if (!confirm("Delete this report? This can't be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/advisor/reports/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={loading}
      style={{
        background: "none",
        border: "none",
        color: "#dc2626",
        fontSize: 12,
        fontWeight: 600,
        cursor: loading ? "not-allowed" : "pointer",
        padding: 0,
      }}
    >
      {loading ? "Deleting…" : "Delete"}
    </button>
  );
}
