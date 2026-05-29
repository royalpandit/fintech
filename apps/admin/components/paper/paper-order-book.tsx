"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cancelPaperOrder,
  fetchPaperOrders,
  type PaperOrderRow,
} from "@/lib/paper-trade-client";

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function PaperOrderBook({
  refreshKey = 0,
  onRefresh,
}: {
  refreshKey?: number;
  onRefresh?: () => void;
}) {
  const [orders, setOrders] = useState<PaperOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "PENDING" | "EXECUTED">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPaperOrders();
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const filtered =
    filter === "all" ? orders : orders.filter(o => o.status === filter);

  const cancel = async (id: number) => {
    if (!confirm("Cancel this pending order?")) return;
    await cancelPaperOrder(id);
    await load();
    onRefresh?.();
  };

  return (
    <div className="paper-order-book">
      <div className="paper-order-book-head">
        <span className="paper-order-book-title">Order book</span>
        <div className="paper-order-book-filters">
          {(["all", "PENDING", "EXECUTED"] as const).map(f => (
            <button
              key={f}
              type="button"
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
          <button type="button" className="paper-refresh-btn" onClick={() => load()}>
            ↺
          </button>
        </div>
      </div>

      {loading && <p className="tt-util-empty">Loading orders…</p>}
      {!loading && filtered.length === 0 && (
        <p className="tt-util-empty">No orders yet. Place a Market or Limit order above.</p>
      )}

      <div className="paper-order-book-list">
        {filtered.map(o => (
          <div key={o.id} className={`paper-order-row status-${o.status.toLowerCase()}`}>
            <div className="paper-order-row-top">
              <span className="paper-order-symbol">{o.symbol}</span>
              <span className={`paper-order-side ${o.side.toLowerCase()}`}>{o.side}</span>
              <span className={`paper-order-status ${o.status.toLowerCase()}`}>{o.status}</span>
            </div>
            <div className="paper-order-row-meta">
              <span>{o.order_type}</span>
              <span>Qty {o.quantity}</span>
              {o.limit_price != null && <span>Lim ₹{o.limit_price}</span>}
              {o.trigger_price != null && <span>Trig ₹{o.trigger_price}</span>}
              {o.execution_price != null && (
                <span className="exec">Fill ₹{o.execution_price}</span>
              )}
            </div>
            <div className="paper-order-row-foot">
              <span>{fmtTime(o.executed_at ?? o.created_at)}</span>
              {o.status === "PENDING" && (
                <button type="button" className="paper-cancel-btn" onClick={() => cancel(o.id)}>
                  Cancel
                </button>
              )}
              {o.reject_reason && (
                <span className="paper-reject">{o.reject_reason}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
