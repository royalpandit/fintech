"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PostActions({
  postId,
  editable,
}: {
  postId: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/advisor/posts/${postId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Delete failed");
        setDeleting(false);
        return;
      }
      router.push("/advisor/posts");
      router.refresh();
    } catch {
      setError("Network error");
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {editable && (
          <Link
            href={`/advisor/posts/${postId}/edit`}
            className="input"
            style={{
              padding: "10px 16px",
              width: "auto",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Edit
          </Link>
        )}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fff",
            color: "#dc2626",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>

      {confirmOpen && (
        <div
          style={{
            padding: 12,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            borderRadius: 10,
            width: 300,
          }}
        >
          <p style={{ margin: 0, marginBottom: 8, fontSize: 13, fontWeight: 600, color: "#991b1b" }}>
            Delete this post?
          </p>
          <p style={{ margin: 0, marginBottom: 10, fontSize: 12, color: "#7f1d1d" }}>
            Soft delete — the post will be hidden from users but kept for audit. This cannot be undone from the UI.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="input"
              style={{ width: "auto", padding: "6px 12px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: "#dc2626",
                color: "#fff",
                fontWeight: 600,
                cursor: deleting ? "not-allowed" : "pointer",
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
