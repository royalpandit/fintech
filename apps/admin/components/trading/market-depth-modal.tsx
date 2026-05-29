"use client";

import type { WatchlistItem } from "./trading-terminal-types";
import MarketDepthPanel from "./market-depth-panel";

export default function MarketDepthModal({
  symbol,
  onClose,
  onOpenChart,
}: {
  symbol: WatchlistItem;
  onClose: () => void;
  onOpenChart?: () => void;
}) {
  return (
    <div className="md-backdrop" onClick={onClose} role="presentation">
      <div className="md-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Market depth">
        <div className="md-head">
          <h3>Market Depth &amp; Quote</h3>
          <button type="button" className="md-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <MarketDepthPanel symbol={symbol} onOpenChart={onOpenChart} />
      </div>
    </div>
  );
}
