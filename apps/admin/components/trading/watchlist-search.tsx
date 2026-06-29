"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WatchlistItem } from "./trading-terminal-types";
import { resolveMarketExchange } from "@/lib/angelone-shared";

function ExchangeBadge({ exchange, type }: { exchange: string; type: string }) {
  const color =
    exchange === "NSE" ? "#2563eb" : exchange === "BSE" ? "#dc2626" : exchange === "NFO" ? "#7c3aed" : "#64748b";
  return (
    <span className="wl-search-exch">
      <span className="wl-search-exch-tag" style={{ color, background: `${color}14` }}>{exchange}</span>
      <span className="wl-search-type">{type}</span>
    </span>
  );
}

export default function WatchlistSearch({
  onAddToWatchlist,
  onQuickAdd,
  quickAddLabel = "Watchlist",
  onBuy,
  onSell,
  onOpenChart,
}: {
  onAddToWatchlist: (item: WatchlistItem) => void;
  /** When set, adds directly to the active list (e.g. My Portfolio). */
  onQuickAdd?: (item: WatchlistItem) => void;
  quickAddLabel?: string;
  onBuy: (item: WatchlistItem) => void;
  onSell: (item: WatchlistItem) => void;
  onOpenChart: (item: WatchlistItem) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<WatchlistItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [tapKey, setTapKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    if (query.length < 1) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/v1/market/search?q=${encodeURIComponent(query)}&exchange=ALL`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.ok) {
        const mapped: WatchlistItem[] = (json.data ?? []).map(
          (d: {
            symbolName: string;
            tradingSymbol: string;
            token: string;
            exchange: string;
            instrumentType: string;
          }) => {
            const type = d.instrumentType || "EQ";
            const exchange = resolveMarketExchange({
              exchange: d.exchange,
              symboltoken: d.token,
              tradingSymbol: d.tradingSymbol,
              instrumentType: type,
            });
            return {
              display: (d.symbolName || d.tradingSymbol).replace(/-EQ$/i, ""),
              tradingSymbol: d.tradingSymbol,
              token: d.token,
              exchange,
              type,
            };
          },
        );
        setResults(mapped);
        setSearchError(mapped.length ? null : (json.message ?? `No results for "${query}"`));
      } else {
        setResults([]);
        setSearchError(json.error ?? "Search failed");
      }
    } catch {
      setResults([]);
      setSearchError("Search request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(q), 300);
  }, [q, search]);

  const rowKey = (r: WatchlistItem) => `${r.exchange}:${r.token}`;

  const handleAdd = (item: WatchlistItem) => {
    if (onQuickAdd) onQuickAdd(item);
    else onAddToWatchlist(item);
    setQ("");
    setResults([]);
    setOpen(false);
  };

  const addLabel = onQuickAdd ? quickAddLabel : `+ ${quickAddLabel}`;

  return (
    <div className="wl-search-wrap">
      <div className="wl-search-input-row">
        {loading ? (
          <span className="wl-search-spinner" aria-hidden />
        ) : (
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        )}
        <input
          value={q}
          onChange={e => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder="Search"
          className="wl-search-input"
        />
        {q ? (
          <button type="button" className="wl-search-clear" onClick={() => { setQ(""); setResults([]); }}>
            ×
          </button>
        ) : (
          <button type="button" className="wl-search-filter" title="Filter (coming soon)" aria-label="Filter">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="wl-search-dropdown" onMouseDown={e => e.preventDefault()}>
          {results.map(r => {
            const key = rowKey(r);
            const hovered = hoverKey === key || tapKey === key;
            return (
              <div
                key={key}
                className={`wl-search-result${hovered ? " hovered" : ""}`}
                onMouseEnter={() => setHoverKey(key)}
                onMouseLeave={() => setHoverKey(null)}
                onClick={() => setTapKey(prev => (prev === key ? null : key))}
              >
                <div className="wl-search-result-main">
                  <div className="wl-search-result-title">{r.display}</div>
                  <div className="wl-search-result-sub">{r.tradingSymbol}</div>
                </div>
                <ExchangeBadge exchange={r.exchange} type={r.type} />
                {hovered && (
                  <div className="wl-search-actions">
                    <button type="button" className="wl-act wl-act-add" onMouseDown={e => e.preventDefault()} onClick={() => handleAdd(r)}>
                      {addLabel}
                    </button>
                    <button type="button" className="wl-act wl-act-buy" onMouseDown={e => e.preventDefault()} onClick={() => { onBuy(r); setOpen(false); }}>
                      Buy
                    </button>
                    <button type="button" className="wl-act wl-act-sell" onMouseDown={e => e.preventDefault()} onClick={() => { onSell(r); setOpen(false); }}>
                      Sell
                    </button>
                    <button type="button" className="wl-act wl-act-chart" onMouseDown={e => e.preventDefault()} onClick={() => { onOpenChart(r); setOpen(false); }}>
                      Chart
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && q.length > 0 && results.length === 0 && !loading && (
        <div className="wl-search-dropdown wl-search-empty" onMouseDown={e => e.preventDefault()}>
          {searchError ?? `No results for "${q}"`}
        </div>
      )}
    </div>
  );
}
