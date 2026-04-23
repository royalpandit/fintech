"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HideCommentButton({ commentId }: { commentId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onClick = async () => {
    if (!confirm("Hide this comment from your post?")) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/advisor/comments/${commentId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {error && <span style={{ fontSize: 12, color: "#b91c1c" }}>{error}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid #fecaca",
          background: "#fff",
          color: "#dc2626",
          fontSize: 12,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Hiding..." : "Hide"}
      </button>
    </div>
  );
}
