"use client";

import TradingTerminal from "@/components/trading/trading-terminal";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";

export default function ChartWorkspace({ initialSymbol }: { initialSymbol?: WatchlistItem }) {
  return (
    <div className="chart-page-scroll">
      <div className="chart-page-terminal">
        <TradingTerminal initialSymbol={initialSymbol} />
      </div>
    </div>
  );
}
