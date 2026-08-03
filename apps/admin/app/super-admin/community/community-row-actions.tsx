"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";

export default function CommunityRowActions({
  id,
  removed,
}: {
  id: number;
  removed: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function remove() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/community-posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        show("Post removed");
        router.refresh();
      } else {
        show("Couldn't remove post", "error");
      }
    } catch {
      show("Network error", "error");
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  async function restore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/community-posts/${id}`, { method: "PATCH" });
      if (res.ok) {
        show("Post restored");
        router.refresh();
      } else {
        show("Couldn't restore post", "error");
      }
    } catch {
      show("Network error", "error");
    } finally {
      setLoading(false);
    }
  }

  if (removed) {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={restore}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
        }}
      >
        {loading ? "…" : "Restore"}
      </button>
    );
  }

  if (confirm) {
    return (
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled={loading}
          onClick={remove}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            border: "none",
            background: "#dc2626",
            color: "#fff",
          }}
        >
          {loading ? "…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        border: "1px solid #fad2cf",
        background: "var(--surface)",
        color: "#c5221f",
      }}
    >
      Remove
    </button>
  );
}
