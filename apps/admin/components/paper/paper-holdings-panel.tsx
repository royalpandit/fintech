"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchPaperSummary,
  paperSymbolFromWatchlist,
  type PaperPosition,
} from "@/lib/paper-trade-client";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";

export default function PaperHoldingsPanel({
  liveQuotes,
  onBuy,
  onSell,
  refreshKey = 0,
}: {
  liveQuotes?: WatchlistItem[];
  onBuy: (symbol: string) => void;
  onSell: (symbol: string) => void;
  refreshKey?: number;
}) {
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [summary, setSummary] = useState<{
    cash_balance: number;
    holdings_value: number;
    total_equity: number;
    total_pnl: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const quotes =
        liveQuotes
          ?.filter(q => q.ltp && q.ltp > 0)
          .map(q => ({
            symbol: paperSymbolFromWatchlist(q),
            ltp: q.ltp!,
          })) ?? [];
      const data = await fetchPaperSummary(quotes);
      setPositions(data.positions);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }, [liveQuotes]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading && !positions.length) {
    return <p className="tt-util-empty">Loading holdings…</p>;
  }

  if (!positions.length) {
    return (
      <p className="tt-util-empty">
        No holdings. Execute a Market Buy to open a position.
      </p>
    );
  }

  return (
    <div className="paper-holdings">
      {summary && (
        <div className="paper-holdings-summary">
          <div>
            <span>Cash</span>
            <b>₹{summary.cash_balance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</b>
          </div>
          <div>
            <span>Holdings</span>
            <b>₹{summary.holdings_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</b>
          </div>
          <div>
            <span>Equity</span>
            <b>₹{summary.total_equity.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</b>
          </div>
          <div>
            <span>P&amp;L</span>
            <b className={summary.total_pnl >= 0 ? "up" : "down"}>
              {summary.total_pnl >= 0 ? "+" : ""}
              ₹{summary.total_pnl.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </b>
          </div>
        </div>
      )}
      <div className="paper-holdings-list">
        {positions.map(p => {
          const up = p.unrealized_pnl >= 0;
          return (
            <div key={p.symbol} className="paper-holding-row">
              <div className="paper-holding-main">
                <div className="paper-holding-symbol">{p.symbol}</div>
                <div className="paper-holding-sub">
                  {p.quantity} @ ₹{p.avg_price.toFixed(2)} avg
                </div>
                <div className="paper-holding-sub">
                  LTP ₹{p.last_price.toFixed(2)} · Value ₹
                  {p.market_value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className={`paper-holding-pnl ${up ? "up" : "down"}`}>
                  {up ? "+" : ""}
                  {p.unrealized_pnl.toFixed(2)} ({p.unrealized_pnl_pct.toFixed(2)}%)
                </div>
              </div>
              <div className="paper-holding-actions">
                <button type="button" className="buy" onClick={() => onBuy(p.symbol)}>
                  Buy More
                </button>
                <button type="button" className="sell" onClick={() => onSell(p.symbol)}>
                  Sell
                </button>
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
