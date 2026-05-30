"use client";

import { FiX } from "react-icons/fi";

export default function PremiumUnlockModal({
  open,
  onClose,
  onUnlock,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onUnlock: () => void;
  loading?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="premium-unlock-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="premium-unlock-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="premium-modal-title"
      >
        <button type="button" className="premium-unlock-modal-close" onClick={onClose} aria-label="Close">
          <FiX size={20} />
        </button>
        <h2 id="premium-modal-title" className="premium-unlock-modal-title">
          Premium Content
        </h2>
        <p className="premium-unlock-modal-body">
          This is a premium post.
          <br />
          Payment integration is coming soon.
        </p>
        <div className="premium-unlock-modal-actions">
          <button
            type="button"
            className="premium-unlock-modal-primary"
            onClick={onUnlock}
            disabled={loading}
          >
            {loading ? "Unlocking…" : "Unlock This Post"}
          </button>
          <button type="button" className="premium-unlock-modal-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
