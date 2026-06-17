"use client";

import { useState } from "react";
import { DEFAULT_SYMBOL } from "./constants";
import { SymbolSearchBar } from "./SymbolSearchBar";
import { TradingViewChart } from "./TradingViewChart";
import type { TradingViewChartProps } from "./types";

type ChartWithSearchProps = Omit<TradingViewChartProps, "symbol"> & {
  initialSymbol?: string;
};

export function ChartWithSearch({
  initialSymbol = DEFAULT_SYMBOL,
  height = "calc(100vh - 64px)",
  ...chartProps
}: ChartWithSearchProps) {
  const [symbol, setSymbol] = useState(initialSymbol);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#131722]">
      <header className="flex shrink-0 flex-col gap-3 border-b border-zinc-800 bg-[#1e222d] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-zinc-100 sm:text-base">
            NSE Live Chart
          </h1>
          <p className="text-xs text-zinc-500">
            Search below — Indian symbols load via TradingView hosted chart
          </p>
        </div>
        <SymbolSearchBar currentSymbol={symbol} onSymbolChange={setSymbol} />
      </header>

      <div className="min-h-0 flex-1">
        <TradingViewChart
          key={symbol}
          symbol={symbol}
          height={height}
          {...chartProps}
        />
      </div>
    </div>
  );
}
