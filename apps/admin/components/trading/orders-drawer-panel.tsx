"use client";

import OrderPanel from "./order-panel";
import PaperOrderBook from "@/components/paper/paper-order-book";
import type { WatchlistItem } from "./trading-terminal-types";

type OrderRow = { symbol: string; side: string; quantity: number; price: number };

export default function OrdersDrawerPanel({
  symbol,
  initialSide,
  orders,
  refreshKey,
  onRefresh,
  onOrderPlaced,
}: {
  symbol: WatchlistItem;
  initialSide?: "BUY" | "SELL";
  orders: OrderRow[];
  refreshKey?: number;
  onRefresh: () => void;
  onOrderPlaced: () => void;
}) {
  return (
    <div className="tt-orders-drawer">
      <OrderPanel
        symbol={symbol}
        initialSide={initialSide}
        onOrderPlaced={() => {
          onOrderPlaced();
          onRefresh();
        }}
      />
      <PaperOrderBook refreshKey={refreshKey} onRefresh={onRefresh} />
      {orders.length > 0 && (
        <div className="tt-orders-history">
          <div className="tt-orders-history-head">
            <span>Today&apos;s fills</span>
            <button type="button" onClick={onRefresh}>↺</button>
          </div>
          <div className="tt-orders-history-list">
            {orders.slice(0, 8).map((o, i) => {
              const isBuy = o.side === "BUY" || o.side === "buy";
              return (
                <div key={i} className="tt-orders-history-row">
                  <div className="tt-orders-history-symbol">{o.symbol}</div>
                  <div className={isBuy ? "up" : "down"}>
                    {o.side.toUpperCase()} · {o.quantity} @ ₹
                    {Number(o.price).toLocaleString("en-IN")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
