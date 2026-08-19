"use client";

import { useState } from "react";
import { FiHeart } from "react-icons/fi";

/**
 * Like / unlike a market post. Optimistic, with rollback on failure so the
 * count never drifts from the server. Backed by /api/v1/market/posts/[id]/like.
 */
export default function MarketLikeButton({
  postId,
  initialLiked,
  initialCount,
}: {
  postId: number;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const wasLiked = liked;
    setBusy(true);
    setLiked(!wasLiked);
    setCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));

    try {
      const res = await fetch(`/api/v1/market/posts/${postId}/like`, { method: "POST" });
      if (!res.ok) throw new Error("like failed");
    } catch {
      setLiked(wasLiked);
      setCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      title={liked ? "Unlike" : "Like"}
      style={{
        height: 34,
        padding: "0 14px",
        borderRadius: 8,
        background: liked ? "rgba(225,29,72,0.10)" : "var(--surface-2)",
        color: liked ? "#e11d48" : "var(--text)",
        border: `1px solid ${liked ? "rgba(225,29,72,0.35)" : "var(--border)"}`,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        lineHeight: 1,
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
      }}
    >
      <FiHeart size={14} style={{ fill: liked ? "#e11d48" : "none" }} />
      {count} {liked ? "Liked" : "Like"}
    </button>
  );
}
