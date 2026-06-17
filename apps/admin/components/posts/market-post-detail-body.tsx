"use client";

import { useState } from "react";
import PostAccessBadge from "./post-access-badge";
import PremiumPostOverlay from "./premium-post-overlay";
import PremiumUnlockModal from "./premium-unlock-modal";
import { usePremiumPostUnlock } from "./use-premium-post-unlock";

type Props = {
  post: {
    id: number;
    title: string;
    content: string;
    post_access_type: "free" | "paid";
    is_locked: boolean;
    is_unlocked: boolean;
  };
  isAuthed: boolean;
  children?: React.ReactNode;
};

export default function MarketPostDetailBody({ post: initial, isAuthed, children }: Props) {
  const [post, setPost] = useState(initial);

  const premium = usePremiumPostUnlock({
    postId: post.id,
    kind: "market",
    initialLocked: post.is_locked,
    initialUnlocked: post.is_unlocked,
    isAuthed,
    onUnlocked: (full) => {
      const f = full as { title?: string; content?: string };
      setPost((prev) => ({
        ...prev,
        title: String(f.title ?? prev.title),
        content: String(f.content ?? prev.content),
        is_locked: false,
        is_unlocked: true,
      }));
    },
  });

  const locked = premium.locked;

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <PostAccessBadge type={post.post_access_type} />
      </div>

      <div className={`premium-post-body${locked ? " is-locked" : ""}`}>
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: 24,
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: -0.4,
          }}
        >
          {post.title}
        </h1>
        <p
          className={locked ? "premium-text-blur" : undefined}
          style={{
            margin: 0,
            fontSize: 15,
            color: "var(--text)",
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
          }}
        >
          {post.content}
        </p>
        {!locked && children}
        {locked && <PremiumPostOverlay onUnlock={premium.openUnlock} />}
      </div>

      <PremiumUnlockModal
        open={premium.modalOpen}
        onClose={() => premium.setModalOpen(false)}
        onUnlock={premium.confirmUnlock}
        loading={premium.loading}
      />
    </>
  );
}
