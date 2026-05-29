"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  defaultSymbol?: string;
  compact?: boolean;
};

export default function PaperTradeForm({ defaultSymbol = "", compact = false }: Props) {
  const router = useRouter();
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async () => {
    setError("");
    setSuccess("");
    const sym = symbol.trim().toUpperCase();
    const qty = Number(quantity);
    const px = Number(price);
    if (!sym) return setError("Symbol required");
    if (!Number.isFinite(qty) || qty <= 0) return setError("Invalid quantity");
    if (!Number.isFinite(px) || px <= 0) return setError("Invalid price");

    setLoading(true);
    try {
      const createRes = await fetch("/api/v1/lab/create", { method: "POST" });
      if (!createRes.ok) {
        const c = await createRes.json();
        if (createRes.status !== 200 && c.status === false) {
          /* wallet may already exist */
        }
      }
      const res = await fetch("/api/v1/lab/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym, side, quantity: qty, price: px }),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) {
        setError(data.error || "Trade failed");
        return;
      }
      setSuccess(
        `${side.toUpperCase()} ${qty} × ${sym} @ ₹${px.toLocaleString("en-IN")} — balance ₹${Number(data.new_balance).toLocaleString("en-IN")}`,
      );
      router.refresh();
    } catch {
      setError("Network error");
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
        <input type="number" placeholder="Price ₹" value={price} onChange={(e) => setPrice(e.target.value)} style={field} />
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
      {compact && (
        <div className="bs-toggle" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: 8 }}>
          <button type="button" className={`bs-toggle-item ${side === "buy" ? "active buy" : ""}`} onClick={() => setSide("buy")}>
            Buy
          </button>
          <button type="button" className={`bs-toggle-item ${side === "sell" ? "active sell" : ""}`} onClick={() => setSide("sell")}>
            Sell
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        style={{
          width: "100%",
          padding: compact ? "8px 12px" : "10px 16px",
          borderRadius: 8,
          border: "none",
          background: side === "buy" ? "#16a34a" : "#dc2626",
          color: "#fff",
          fontWeight: 700,
          fontSize: 13,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Placing…" : `Place paper ${side}`}
      </button>
      {error && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#b91c1c" }}>{error}</p>}
      {success && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#047857" }}>{success}</p>}
    </div>
  );
}
