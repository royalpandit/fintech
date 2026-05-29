"use client";

import { useEffect, useState } from "react";
import type { WatchlistItem } from "./trading-terminal-types";
import {
  paperSymbolFromWatchlist,
  placePaperOrder,
  type PaperOrderType,
} from "@/lib/paper-trade-client";

export default function OrderPanel({
  symbol,
  initialSide = "BUY",
  onOrderPlaced,
}: {
  symbol: WatchlistItem;
  initialSide?: "BUY" | "SELL";
  onOrderPlaced?: () => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">(initialSide);
  const [orderType, setOrderType] = useState<PaperOrderType>("MARKET");
  const [product, setProduct] = useState<"CNC" | "MIS" | "NRML">("CNC");
  const [qty, setQty] = useState("1");
  const [limitPrice, setLimitPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isIndex = symbol.type === "INDEX";
  const showLimit = orderType === "LIMIT" || orderType === "SL";
  const showTrigger = orderType === "SL" || orderType === "SL-M";

  useEffect(() => {
    setSide(initialSide);
  }, [initialSide, symbol.token]);

  useEffect(() => {
    if (symbol.ltp != null && symbol.ltp > 0) {
      const p = String(symbol.ltp);
      setLimitPrice(p);
      setTriggerPrice(p);
    }
  }, [symbol.token, symbol.ltp]);

  const placeOrder = async () => {
    if (isIndex) return;
    setLoading(true);
    setMsg(null);
    try {
      const sym = paperSymbolFromWatchlist(symbol);
      const quantity = Math.max(1, Number(qty) || 0);

      if (orderType === "MARKET" && (!symbol.ltp || symbol.ltp <= 0)) {
        setMsg({
          ok: false,
          text: "Live price not available — wait for market data or use a Limit order.",
        });
        return;
      }

      const result = await placePaperOrder({
        symbol: sym,
        side: side === "BUY" ? "buy" : "sell",
        orderType,
        quantity,
        limitPrice: showLimit ? Number(limitPrice) : undefined,
        triggerPrice: showTrigger ? Number(triggerPrice) : undefined,
        product,
        token: symbol.token,
        exchange: symbol.exchange,
        tradingSymbol: symbol.tradingSymbol,
      });
      setMsg({ ok: result.ok, text: result.text });
      if (result.ok) onOrderPlaced?.();
    } catch {
      setMsg({ ok: false, text: "Network error — sign in to use paper trading." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tt-order-panel">
      <p className="tt-order-badge">Paper trading · broker simulation</p>
      <p className="tt-order-ltp">
        LTP:{" "}
        {symbol.ltp != null && symbol.ltp > 0
          ? `₹${symbol.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
          : "—"}
      </p>
      <div className="tt-order-side-toggle">
        {(["BUY", "SELL"] as const).map(s => (
          <button
            key={s}
            type="button"
            className={side === s ? `active ${s.toLowerCase()}` : ""}
            onClick={() => setSide(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {isIndex ? (
        <p className="tt-util-empty">Index cannot be traded directly.</p>
      ) : (
        <>
          <label className="tt-order-label">Order Type</label>
          <select
            className="tt-order-select"
            value={orderType}
            onChange={e => setOrderType(e.target.value as PaperOrderType)}
          >
            <option value="MARKET">Market — fill at live LTP</option>
            <option value="LIMIT">Limit — fill when price reached</option>
            <option value="SL">Stop Loss (SL)</option>
            <option value="SL-M">Stop Loss Market (SL-M)</option>
          </select>

          <label className="tt-order-label">Product</label>
          <div className="tt-order-product-row">
            {(["CNC", "MIS", "NRML"] as const).map(p => (
              <button
                key={p}
                type="button"
                className={product === p ? "active" : ""}
                onClick={() => setProduct(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <label className="tt-order-label">Quantity</label>
          <input
            type="number"
            min={1}
            className="tt-order-input"
            value={qty}
            onChange={e => setQty(e.target.value)}
          />

          {showLimit && (
            <>
              <label className="tt-order-label">
                {orderType === "SL" ? "Limit price (after trigger)" : "Limit price"}
              </label>
              <input
                type="number"
                className="tt-order-input"
                value={limitPrice}
                onChange={e => setLimitPrice(e.target.value)}
              />
            </>
          )}

          {showTrigger && (
            <>
              <label className="tt-order-label">Trigger price</label>
              <input
                type="number"
                className="tt-order-input"
                value={triggerPrice}
                onChange={e => setTriggerPrice(e.target.value)}
              />
            </>
          )}

          {orderType === "LIMIT" && (
            <p className="tt-order-hint">
              Buy limit executes when LTP ≤ your price. Sell limit when LTP ≥ your price.
            </p>
          )}

          <button
            type="button"
            className={`tt-order-submit ${side.toLowerCase()}`}
            onClick={placeOrder}
            disabled={loading}
          >
            {loading ? "Placing…" : `${side} ${symbol.display}`}
          </button>

          {msg && <div className={`tt-order-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
        </>
      )}
    </div>
  );
}
