"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPaperTrades, type PaperTradeRow } from "@/lib/paper-trade-client";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function PaperTradeHistoryPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [trades, setTrades] = useState<PaperTradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTrades(await fetchPaperTrades(150));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) return <p className="tt-util-empty">Loading trade history…</p>;
  if (!trades.length) return <p className="tt-util-empty">No executed trades yet.</p>;

  return (
    <div className="paper-trade-history">
      <div className="paper-th-table-wrap">
        <table className="paper-th-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Price</th>
              <th>P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => {
              const isBuy = t.side === "buy";
              const pnl = t.realized_pnl;
              return (
                <tr key={t.id}>
                  <td>{fmtDate(t.traded_at)}</td>
                  <td className="sym">{t.symbol}</td>
                  <td className={isBuy ? "buy" : "sell"}>{t.side.toUpperCase()}</td>
                  <td>{t.quantity}</td>
                  <td>₹{Number(t.price).toLocaleString("en-IN")}</td>
                  <td className={pnl != null ? (pnl >= 0 ? "up" : "down") : ""}>
                    {pnl != null ? `${pnl >= 0 ? "+" : ""}₹${pnl.toFixed(2)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="tt-util-refresh" onClick={() => load()}>
        Refresh
      </button>
    </div>
  );
}
