"use client";

import { FiLock } from "react-icons/fi";

export default function PremiumPostOverlay({
  onUnlock,
  compact = false,
}: {
  onUnlock: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`premium-post-overlay${compact ? " compact" : ""}`} aria-hidden={false}>
      <div className="premium-post-overlay-inner">
        <FiLock size={compact ? 22 : 28} className="premium-post-lock-icon" />
        <p className="premium-post-overlay-title">🔒 Premium Post</p>
        <p className="premium-post-overlay-msg">Unlock this post</p>
        <button type="button" className="premium-post-unlock-btn" onClick={onUnlock}>
          Unlock Post
        </button>
      </div>
    </div>
  );
}
