"use client";

import type { UtilityPanelId } from "./trading-utility-types";
import { UTILITY_PANEL_LABELS } from "./trading-utility-types";

export default function UtilityDrawer({
  open,
  panelId,
  onClose,
  children,
}: {
  open: boolean;
  panelId: UtilityPanelId | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const title = panelId ? UTILITY_PANEL_LABELS[panelId] : "";

  return (
    <div
      className={`tt-utility-drawer${open ? " open" : ""}`}
      aria-hidden={!open}
    >
      <div className="tt-utility-drawer-inner">
        <header className="tt-utility-drawer-head">
          <h2 className="tt-utility-drawer-title">{title}</h2>
          <button
            type="button"
            className="tt-utility-drawer-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            ×
          </button>
        </header>
        <div className="tt-utility-drawer-body">{children}</div>
      </div>
    </div>
  );
}
