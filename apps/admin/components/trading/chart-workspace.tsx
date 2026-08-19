"use client";

import { useState } from "react";
import TradingTerminal from "@/components/trading/trading-terminal";
import ChartAnalyzer from "@/components/trading/chart-analyzer";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";

const NIFTY: WatchlistItem = {
  display: "NIFTY 50",
  tradingSymbol: "NIFTY 50",
  token: "99926000",
  exchange: "NSE",
  type: "INDEX",
};

// Wraps the chart terminal + the Chart Analyst panel and keeps them in sync:
// the analyzer follows whatever instrument is selected in the terminal.
export default function ChartWorkspace({ initialSymbol }: { initialSymbol?: WatchlistItem }) {
  const [active, setActive] = useState<WatchlistItem>(initialSymbol ?? NIFTY);

  return (
    <div className="chart-page-scroll">
      <div className="chart-page-terminal">
        <TradingTerminal initialSymbol={initialSymbol} onSymbolChange={setActive} />
      </div>
      {active?.token && active?.exchange && (
        <div className="chart-page-analyzer">
          <ChartAnalyzer
            symbol={active.display || active.tradingSymbol}
            token={active.token}
            exchange={active.exchange}
          />
        </div>
      )}
    </div>
  );
}
