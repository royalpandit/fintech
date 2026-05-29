"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchPaperSummary,
  paperSymbolFromWatchlist,
  type PaperPosition,
} from "@/lib/paper-trade-client";
import type { WatchlistItem } from "./trading-terminal-types";

export default function PositionsPanel({
  liveQuotes,
  refreshKey = 0,
}: {
  liveQuotes?: WatchlistItem[];
  refreshKey?: number;
}) {
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ unrealized_pnl?: number; total_equity?: number } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const quotes =
        liveQuotes
          ?.filter(q => q.ltp && q.ltp > 0)
          .map(q => ({
            symbol: paperSymbolFromWatchlist(q),
            ltp: q.ltp!,
          })) ?? [];
      const data = await fetchPaperSummary(quotes);
      if (!data.summary) {
        setError("Sign in and create a paper wallet");
        setPositions([]);
        return;
      }
      setPositions(data.positions);
      setSummary(data.summary);
    } catch {
      setError("Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, [liveQuotes]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load, refreshKey]);

  if (loading && !positions.length) {
    return <p className="tt-util-empty">Loading positions…</p>;
  }

  if (error) {
    return <p className="tt-util-empty tt-util-warn">{error}</p>;
  }

  if (!positions.length) {
    return (
      <p className="tt-util-empty">
        No open positions. Place a Market Buy from Orders.
      </p>
    );
  }

  return (
    <div className="tt-positions">
      {summary && (
        <div className="tt-positions-summary">
          <span>Equity</span>
          <b>₹{Number(summary.total_equity ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</b>
          <span className={(summary.unrealized_pnl ?? 0) >= 0 ? "up" : "down"}>
            Unrealized ₹{Number(summary.unrealized_pnl ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
      <div className="tt-positions-list">
        {positions.map(p => {
          const up = p.unrealized_pnl >= 0;
          return (
            <div key={p.symbol} className="tt-positions-row">
              <div className="tt-positions-left">
                <div className="tt-positions-symbol">{p.symbol}</div>
                <div className="tt-positions-qty">{p.quantity} @ ₹{p.avg_price.toFixed(2)}</div>
              </div>
              <div className="tt-positions-right">
                <div className="tt-positions-ltp">₹{p.last_price.toFixed(2)}</div>
                <div className={up ? "up" : "down"}>
                  {up ? "+" : ""}
                  {p.unrealized_pnl.toFixed(2)} ({p.unrealized_pnl_pct.toFixed(2)}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="tt-util-refresh" onClick={() => load()}>
        Refresh
      </button>
    </div>
  );
}
