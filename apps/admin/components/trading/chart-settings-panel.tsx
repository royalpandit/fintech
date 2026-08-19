"use client";

import { useEffect, useRef, useState } from "react";
import { FiCrosshair, FiTrash2, FiX } from "react-icons/fi";
import type { WatchlistItem } from "./trading-terminal-types";
import { loadDrawings, saveDrawings } from "@/lib/chart-drawings";

/**
 * Chart settings popover.
 *
 * The gear icon in the tool rail was a bare <button> with no handler, so
 * clicking it did nothing. This gives it real, working controls rather than
 * a decorative panel.
 */
export default function ChartSettingsPanel({
  symbol,
  timeframeId,
  onClose,
  onResetViewport,
}: {
  symbol: WatchlistItem;
  timeframeId: string;
  onClose: () => void;
  onResetViewport: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const instrumentKey = `${symbol.exchange}:${symbol.token}:${timeframeId}`;
  const [drawingCount, setDrawingCount] = useState(0);

  useEffect(() => {
    setDrawingCount(loadDrawings(instrumentKey).length);
  }, [instrumentKey]);

  // Close on outside click / Escape, like the other chart menus.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function clearDrawings() {
    saveDrawings(instrumentKey, []);
    setDrawingCount(0);
    // The overlay reads localStorage on instrument change, so force a repaint.
    window.dispatchEvent(new Event("finuer-drawings-cleared"));
  }

  return (
    <div ref={ref} className="cs-panel" role="dialog" aria-label="Chart settings">
      <header className="cs-head">
        <span>Chart settings</span>
        <button type="button" onClick={onClose} aria-label="Close" className="cs-close">
          <FiX size={14} />
        </button>
      </header>

      <p className="cs-context">
        {symbol.display} · {symbol.exchange} · {timeframeId}
      </p>

      <button type="button" className="cs-row" onClick={onResetViewport}>
        <FiCrosshair size={14} />
        <span>
          Reset zoom
          <small>Re-anchor to the latest candles</small>
        </span>
      </button>

      <button
        type="button"
        className="cs-row"
        onClick={clearDrawings}
        disabled={drawingCount === 0}
      >
        <FiTrash2 size={14} />
        <span>
          Clear drawings{drawingCount ? ` (${drawingCount})` : ""}
          <small>
            {drawingCount
              ? "Removes every shape saved on this symbol & timeframe"
              : "Nothing drawn on this symbol & timeframe"}
          </small>
        </span>
      </button>

      <p className="cs-note">
        Timeframe, chart type and indicators are in the toolbar above the chart.
      </p>
    </div>
  );
}
