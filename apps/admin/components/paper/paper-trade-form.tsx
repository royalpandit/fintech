"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { placePaperOrder } from "@/lib/paper-trade-client";

type Props = {
  defaultSymbol?: string;
  compact?: boolean;
};

export default function PaperTradeForm({ defaultSymbol = "", compact = false }: Props) {
  const router = useRouter();
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("1");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async () => {
    setError("");
    setSuccess("");
    const sym = symbol.trim().toUpperCase();
    const qty = Number(quantity);
    if (!sym) return setError("Symbol required");
    if (!Number.isFinite(qty) || qty <= 0) return setError("Invalid quantity");
    if (orderType === "LIMIT") {
      const lim = Number(limitPrice);
      if (!Number.isFinite(lim) || lim <= 0) return setError("Limit price required");
    }

    setLoading(true);
    try {
      const result = await placePaperOrder({
        symbol: sym,
        side,
        orderType,
        quantity: qty,
        limitPrice: orderType === "LIMIT" ? Number(limitPrice) : undefined,
      });
      if (!result.ok) {
        setError(result.text);
        return;
      }
      setSuccess(result.text);
      router.refresh();
    } catch {
      setError("Network error — sign in to use paper trading.");
    } finally {
      setLoading(false);
    }
  };

  const field: React.CSSProperties = {
    width: "100%",
    height: compact ? 36 : 40,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid #eef0f4",
    fontSize: 12,
    fontWeight: 600,
    boxSizing: "border-box",
  };

  return (
    <div>
      <div className={compact ? "paper-trade-grid-compact" : "paper-trade-grid"}>
        <input placeholder="Symbol (e.g. RELIANCE)" value={symbol} onChange={(e) => setSymbol(e.target.value)} style={field} />
        <input type="number" placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={field} />
        <select value={orderType} onChange={(e) => setOrderType(e.target.value as "MARKET" | "LIMIT")} style={field}>
          <option value="MARKET">Market (live LTP)</option>
          <option value="LIMIT">Limit</option>
        </select>
        {orderType === "LIMIT" && (
          <input type="number" placeholder="Limit price ₹" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} style={field} />
        )}
        {!compact && (
          <div className="bs-toggle" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <button type="button" className={`bs-toggle-item ${side === "buy" ? "active buy" : ""}`} onClick={() => setSide("buy")}>
              Buy
            </button>
            <button type="button" className={`bs-toggle-item ${side === "sell" ? "active sell" : ""}`} onClick={() => setSide("sell")}>
              Sell
            </button>
          </div>
        )}
      </div>
      {error && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{error}</p>}
      {success && <p style={{ color: "#16a34a", fontSize: 12, marginTop: 8 }}>{success}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "10px 0",
          borderRadius: 8,
          border: "none",
          background: side === "buy" ? "#16a34a" : "#dc2626",
          color: "#fff",
          fontWeight: 800,
          fontSize: 13,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Placing…" : `${side.toUpperCase()} ${symbol || "—"}`}
      </button>
    </div>
  );
}
