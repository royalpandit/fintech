"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      await fetch("/api/v1/advisor/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className="input"
      style={{ width: "auto", padding: "10px 18px", fontWeight: 600 }}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? "Marking..." : "Mark all as read"}
    </button>
  );
}
