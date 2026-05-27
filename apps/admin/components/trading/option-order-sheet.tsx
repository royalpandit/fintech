"use client";

import { useEffect, useState } from "react";
import type { WatchlistItem } from "./trading-terminal-types";

export default function OptionOrderSheet({
  symbol,
  initialSide,
  onClose,
  onOpenChart,
  onOpenDepth,
}: {
  symbol: WatchlistItem;
  initialSide: "BUY" | "SELL";
  onClose: () => void;
  onOpenChart?: () => void;
  onOpenDepth?: () => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">(initialSide);
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [product, setProduct] = useState<"MIS" | "NRML">("NRML");
  const [lots, setLots] = useState("1");
  const [price, setPrice] = useState(String(symbol.ltp ?? 0));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const lotSize = 65;
  const qty = String(Math.max(1, Number(lots) || 0) * lotSize);
  const down = (symbol.changePct ?? 0) < 0;

  useEffect(() => {
    setSide(initialSide);
  }, [initialSide]);

  useEffect(() => {
    if (symbol.ltp != null) setPrice(String(symbol.ltp));
  }, [symbol.ltp, symbol.token]);

  const placeOrder = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const isMarket = orderType === "MARKET";
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variety: "regular",
          tradingsymbol: symbol.tradingSymbol,
          symboltoken: symbol.token,
          transactiontype: side,
          exchange: symbol.exchange,
          ordertype: isMarket ? "MARKET" : "LIMIT",
          producttype: product,
          duration: "DAY",
          price: isMarket ? "0" : price,
          triggerprice: "0",
          squareoff: "0",
          stoploss: "0",
          quantity: qty,
        }),
      });
      const json = await res.json();
      setMsg(json.ok
        ? { ok: true, text: `Order placed! ID: ${json.orderId}` }
        : { ok: false, text: json.error ?? "Order failed" });
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="oos-backdrop" onClick={onClose} role="presentation">
      <div className="oos-sheet" onClick={e => e.stopPropagation()} role="dialog">
        <div className="oos-head">
          <div>
            <div className="oos-title">{symbol.display}</div>
            <div className="oos-price">
              <span className={down ? "down" : "up"}>
                {(symbol.ltp ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <span className={down ? "down" : "up"}>
                {(symbol.change ?? 0) >= 0 ? "+" : ""}{(symbol.change ?? 0).toFixed(2)}
                {" "}({(symbol.changePct ?? 0).toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="oos-head-actions">
            <div className="oos-bs">
              <button type="button" className={side === "BUY" ? "b on" : "b"} onClick={() => setSide("BUY")}>B</button>
              <button type="button" className={side === "SELL" ? "s on" : "s"} onClick={() => setSide("SELL")}>S</button>
            </div>
            <button type="button" className="oos-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="oos-tabs">
          <span className="on">Regular</span>
          <span className="off">Stop Loss</span>
          <span className="off">GTT</span>
        </div>

        <div className="oos-body">
          <div className="oos-row">
            <label>Product</label>
            <div className="oos-toggle">
              <button type="button" className={product === "MIS" ? "on" : ""} onClick={() => setProduct("MIS")}>INT</button>
              <button type="button" className={product === "NRML" ? "on" : ""} onClick={() => setProduct("NRML")}>CF</button>
            </div>
          </div>

          <div className="oos-field">
            <label>Lots <span className="oos-hint">1 Lot = {lotSize} Qty</span></label>
            <input type="number" min="1" value={lots} onChange={e => setLots(e.target.value)} />
          </div>

          <div className="oos-field">
            <label>Price</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              disabled={orderType === "MARKET"}
            />
          </div>

          <div className="oos-row">
            <label>Order type</label>
            <div className="oos-toggle">
              <button type="button" className={orderType === "LIMIT" ? "on" : ""} onClick={() => setOrderType("LIMIT")}>Limit</button>
              <button type="button" className={orderType === "MARKET" ? "on" : ""} onClick={() => setOrderType("MARKET")}>Market</button>
            </div>
          </div>

          <button
            type="button"
            className={`oos-place ${side.toLowerCase()}`}
            disabled={loading || !lots}
            onClick={placeOrder}
          >
            {loading ? "Placing…" : `PLACE ${side} ORDER`}
          </button>

          {msg && (
            <p className={msg.ok ? "oos-msg ok" : "oos-msg err"}>{msg.text}</p>
          )}
        </div>

        <div className="oos-rail">
          {onOpenChart && (
            <button type="button" title="Chart" onClick={onOpenChart}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>
            </button>
          )}
          {onOpenDepth && (
            <button type="button" title="Market depth" onClick={onOpenDepth}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="5" width="3" height="14" rx="0.5"/><rect x="10" y="8" width="3" height="11" rx="0.5"/><rect x="16" y="3" width="3" height="16" rx="0.5"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
