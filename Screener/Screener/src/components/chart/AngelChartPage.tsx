"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AngelStockChart } from "./AngelStockChart";
import { IntervalDropdown } from "./IntervalDropdown";
import { OptionChainPanel } from "./OptionChainPanel";
import { OverviewPanel } from "./OverviewPanel";
import { TabNav, type AppTab } from "./TabNav";
import { fetchApi } from "@/lib/client/fetch-api";
import type { ChartTimeframe } from "@/lib/smartapi/types";

interface SearchResult {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
  displayName: string;
}

function suggestionKey(s: SearchResult): string {
  return `${s.exchange}:${s.tradingsymbol}:${s.symboltoken}`;
}

export function AngelChartPage({
  initialSymbol = "RELIANCE",
}: {
  initialSymbol?: string;
}) {
  const [activeTab, setActiveTab] = useState<AppTab>("chart");
  const [symbolQuery, setSymbolQuery] = useState(initialSymbol);
  const [searchInput, setSearchInput] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("ONE_DAY");
  const [activeLabel, setActiveLabel] = useState("RELIANCE");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [isLoadingSymbol, setIsLoadingSymbol] = useState(false);

  const applySymbol = useCallback((displayName: string) => {
    const next = displayName.trim().toUpperCase().replace(/^NSE:/, "");
    if (!next) return;
    setSymbolQuery(next);
    setSearchInput(next);
    setActiveLabel(next);
    setShowSuggestions(false);
    setSuggestions([]);
    setLoadKey((k) => k + 1);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    const term = q.trim().toUpperCase().replace(/^NSE:/, "").split(/[,\s]+/)[0];
    if (term.length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      const json = await fetchApi<{ results: SearchResult[] }>(
        `/api/smartapi/search?q=${encodeURIComponent(term)}`,
      );
      setSuggestions(json.results ?? []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput, fetchSuggestions]);

  const handleLoad = async (e?: FormEvent) => {
    e?.preventDefault();
    setIsLoadingSymbol(true);

    try {
      const json = await fetchApi<{ symbol: { displayName: string } }>(
        `/api/smartapi/resolve?symbol=${encodeURIComponent(searchInput)}`,
      );

      if (json.symbol?.displayName) {
        applySymbol(json.symbol.displayName);
      } else {
        applySymbol(
          searchInput.trim().toUpperCase().replace(/^NSE:/, "").split(/[,\s]+/)[0],
        );
      }
    } catch {
      applySymbol(
        searchInput.trim().toUpperCase().replace(/^NSE:/, "").split(/[,\s]+/)[0],
      );
    } finally {
      setIsLoadingSymbol(false);
    }
  };

  const pickSymbol = (item: SearchResult) => {
    applySymbol(item.displayName);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
      <TabNav active={activeTab} onChange={setActiveTab} />

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 sm:px-6">
        <form
          onSubmit={handleLoad}
          className="relative flex min-w-[200px] flex-1 items-center gap-2"
        >
          <div className="relative max-w-md min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
              NSE
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value.toUpperCase());
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              placeholder="RELIANCE, TCS, NIFTY"
              autoComplete="off"
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-12 pr-3 text-sm text-zinc-900 outline-none focus:border-[#4a69bd] focus:ring-2 focus:ring-[#4a69bd]/20"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute top-full z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                {suggestions.map((s) => (
                  <li key={suggestionKey(s)}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        pickSymbol(s);
                      }}
                    >
                      {s.displayName}
                      <span className="ml-2 text-xs text-zinc-400">
                        {s.tradingsymbol}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoadingSymbol}
            className="shrink-0 rounded-lg bg-[#4a69bd] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d58a8] disabled:opacity-60"
          >
            {isLoadingSymbol ? "…" : "Load"}
          </button>
        </form>

        {activeTab === "chart" && (
          <IntervalDropdown value={timeframe} onChange={setTimeframe} />
        )}

        <span className="text-xs text-zinc-500">
          {activeLabel} · SmartAPI
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "chart" && (
          <AngelStockChart
            key={`chart-${symbolQuery}-${timeframe}-${loadKey}`}
            symbolQuery={symbolQuery}
            timeframe={timeframe}
            onSymbolResolved={(s) => setActiveLabel(s.displayName)}
          />
        )}
        {activeTab === "overview" && (
          <OverviewPanel
            key={`overview-${symbolQuery}-${loadKey}`}
            symbolQuery={symbolQuery}
          />
        )}
        {activeTab === "option-chain" && (
          <OptionChainPanel
            key={`oc-${symbolQuery}-${loadKey}`}
            symbolQuery={symbolQuery}
            refreshKey={loadKey}
          />
        )}
      </div>
    </div>
  );
}
