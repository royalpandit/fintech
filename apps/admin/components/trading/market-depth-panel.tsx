"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketDepthQuote } from "@/lib/angelone-types";
import type { WatchlistItem } from "./trading-terminal-types";

function fmtNum(n: number) {
  return n.toLocaleString("en-IN");
}

function fmtP(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Inline market depth (drawer); same data as MarketDepthModal. */
export default function MarketDepthPanel({
  symbol,
  onOpenChart,
}: {
  symbol: WatchlistItem;
  onOpenChart?: () => void;
}) {
  const [data, setData] = useState<MarketDepthQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        token: symbol.token,
        exchange: symbol.exchange,
        tradingSymbol: symbol.tradingSymbol,
      });
      const res = await fetch(`/api/v1/market/depth?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error ?? "Failed to load depth");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [symbol.token, symbol.exchange, symbol.tradingSymbol]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 10_000);
    return () => clearInterval(id);
  }, [load]);

  const down = (data?.percentChange ?? symbol.changePct ?? 0) < 0;
  const totalQty = (data?.totalBuyQty ?? 0) + (data?.totalSellQty ?? 0);
  const buyPct = totalQty > 0 ? (data!.totalBuyQty / totalQty) * 100 : 50;

  return (
    <div className="md-panel">
      <div className="md-symbol-row">
        <div>
          <div className="md-symbol-name">{symbol.display || symbol.tradingSymbol}</div>
          <div className="md-symbol-price">
            <span className={down ? "down" : "up"}>{fmtP(data?.ltp ?? symbol.ltp ?? 0)}</span>
            <span className={down ? "down chg" : "up chg"}>
              {down ? "▼" : "▲"} {fmtP(Math.abs(data?.netChange ?? symbol.change ?? 0))}
              {" "}({(data?.percentChange ?? symbol.changePct ?? 0).toFixed(2)}%)
            </span>
          </div>
        </div>
        {onOpenChart && (
          <button type="button" className="md-icon-btn" title="Chart" onClick={onOpenChart}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 3 3 5-6" />
            </svg>
          </button>
        )}
      </div>

      {loading && !data ? (
        <p className="md-loading">Loading market depth…</p>
      ) : error && !data ? (
        <p className="md-error">{error}</p>
      ) : data ? (
        <>
          <table className="md-table">
            <thead>
              <tr>
                <th className="buy-h">Qty.</th>
                <th className="buy-h">Orders</th>
                <th className="buy-h">Buy Price</th>
                <th className="sell-h">Sell Price</th>
                <th className="sell-h">Orders</th>
                <th className="sell-h">Qty.</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(data.buy.length, data.sell.length, 5) }).map((_, i) => {
                const b = data.buy[i];
                const s = data.sell[i];
                return (
                  <tr key={i}>
                    <td className="buy">{b ? fmtNum(b.quantity) : "—"}</td>
                    <td className="buy">{b ? b.orders : "—"}</td>
                    <td className="buy price">{b ? fmtP(b.price) : "—"}</td>
                    <td className="sell price">{s ? fmtP(s.price) : "—"}</td>
                    <td className="sell">{s ? s.orders : "—"}</td>
                    <td className="sell">{s ? fmtNum(s.quantity) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="md-qty-bar-wrap">
            <div className="md-qty-bar">
              <div className="md-qty-buy" style={{ width: `${buyPct}%` }} />
              <div className="md-qty-sell" style={{ width: `${100 - buyPct}%` }} />
            </div>
            <div className="md-qty-labels">
              <span className="buy">{fmtNum(data.totalBuyQty)}</span>
              <span className="mid">Total Quantity</span>
              <span className="sell">{fmtNum(data.totalSellQty)}</span>
            </div>
          </div>

          <div className="md-stats">
            <div><span>Open</span><b>{fmtP(data.open)}</b></div>
            <div><span>High</span><b className="up">{fmtP(data.high)}</b></div>
            <div><span>Low</span><b className="down">{fmtP(data.low)}</b></div>
            <div><span>Close</span><b>{fmtP(data.close)}</b></div>
            {data.avgPrice != null && (
              <div><span>Avg Price</span><b>{fmtP(data.avgPrice)}</b></div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
