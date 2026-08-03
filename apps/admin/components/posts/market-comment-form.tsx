"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Add a comment to a market post.
export default function MarketCommentForm({ postId }: { postId: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/market/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setText("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "flex-end" }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment…"
        rows={2}
        style={{
          flex: 1,
          resize: "vertical",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 13,
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !text.trim()}
        className="btn-primary"
        style={{ padding: "10px 18px", fontSize: 13, cursor: busy || !text.trim() ? "not-allowed" : "pointer", opacity: !text.trim() ? 0.6 : 1 }}
      >
        {busy ? "Posting…" : "Post"}
      </button>
    </div>
  );
}
