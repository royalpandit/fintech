"use client";

import { FormEvent, useState } from "react";
import { normalizeNseSymbol } from "@/lib/tradingview/build-widget-embed-url";
import { DEFAULT_SYMBOL } from "./constants";

interface SymbolSearchBarProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

export function SymbolSearchBar({
  currentSymbol,
  onSymbolChange,
}: SymbolSearchBarProps) {
  const [query, setQuery] = useState(
    currentSymbol.replace(/^NSE:/i, ""),
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = normalizeNseSymbol(query);
    onSymbolChange(next);
    setQuery(next.replace(/^NSE:/i, ""));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xl items-center gap-2"
    >
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500">
          NSE:
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value.toUpperCase())}
          placeholder="RELIANCE, TCS, INFY…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-11 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
          aria-label="Search NSE stock symbol"
        />
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
      >
        Load
      </button>
      <button
        type="button"
        className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        onClick={() => {
          onSymbolChange(DEFAULT_SYMBOL);
          setQuery("RELIANCE");
        }}
      >
        Reset
      </button>
    </form>
  );
}
