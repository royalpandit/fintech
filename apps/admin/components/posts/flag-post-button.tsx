"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiFlag } from "react-icons/fi";
import { useToast } from "@/components/toast";

/**
 * Flag your own market post for review. Pairs with the "Flagged" tab on the
 * advisor posts list, which previously nothing could populate manually.
 */
export default function FlagPostButton({
  postId,
  alreadyFlagged = false,
}: {
  postId: number;
  alreadyFlagged?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (alreadyFlagged) {
    return (
      <span className="post-flagged-tag" title="Awaiting moderator review">
        <FiFlag size={11} /> Flagged
      </span>
    );
  }

  async function flag() {
    if (busy) return;
    const reason = window.prompt(
      "Flag this post for review? Optionally say why (this unpublishes it):",
      "",
    );
    // Cancel returns null; an empty string is a valid "no reason given".
    if (reason === null) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/v1/advisor/posts/${postId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status === false) {
        toast.show(json.error || "Couldn't flag this post", "error");
        return;
      }
      toast.show("Post flagged and sent for review", "success");
      router.refresh();
    } catch {
      toast.show("Network error. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="post-flag-btn" onClick={() => void flag()} disabled={busy}>
      <FiFlag size={12} /> {busy ? "…" : "Flag"}
    </button>
  );
}
