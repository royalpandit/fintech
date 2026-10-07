"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { placePaperOrder } from "@/lib/paper-trade-client";

type SearchRow = {
  exchange: string;
  tradingSymbol: string;
  symbolName: string;
  token: string;
};

type Props = {
  defaultSymbol?: string;
  /** Pre-selects Buy or Sell — set by the Buy/Sell shortcuts in Markets and
   *  the Watchlist, which deep-link here with ?symbol= and ?side=. */
  defaultSide?: "buy" | "sell";
  compact?: boolean;
};

export default function PaperTradeForm({
  defaultSymbol = "",
  defaultSide = "buy",
  compact = false,
}: Props) {
  const router = useRouter();
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<"buy" | "sell">(defaultSide);
  const [quantity, setQuantity] = useState("1");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [openList, setOpenList] = useState(false);
  // A pick fills the input, which would otherwise look like typing and reopen
  // the list on top of the selection.
  const justPicked = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = symbol.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/market/search?q=${encodeURIComponent(q)}&exchange=ALL`, {
          cache: "no-store",
        });
        const json = await res.json();
        const rows: SearchRow[] = json.ok === false ? [] : (json.data ?? []);
        // The same ticker is listed on both exchanges and an order here carries
        // only the symbol, so the two rows would pick identically.
        const seen = new Set<string>();
        const unique = rows.filter((r) => {
          const key = r.tradingSymbol.replace(/-EQ$/i, "").toUpperCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setResults(unique.slice(0, 8));
        setOpenList(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [symbol]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpenList(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (row: SearchRow) => {
    justPicked.current = true;
    setSymbol(row.tradingSymbol.replace(/-EQ$/i, ""));
    setResults([]);
    setOpenList(false);
  };

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
    border: "1px solid var(--border)",
    fontSize: 12,
    fontWeight: 600,
    boxSizing: "border-box",
  };

  return (
    <div>
      <div className={compact ? "paper-trade-grid-compact" : "paper-trade-grid"}>
        <div ref={box} style={{ position: "relative" }}>
          <input
            placeholder="Search symbol (RELIANCE, TCS, NIFTY…)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onFocus={() => results.length > 0 && setOpenList(true)}
            autoComplete="off"
            style={field}
          />
          {openList && (searching || results.length > 0 || symbol.trim()) && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                zIndex: 30,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              {searching && (
                <p style={{ margin: 0, padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                  Searching…
                </p>
              )}
              {!searching && results.length === 0 && (
                <p style={{ margin: 0, padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                  No symbols found
                </p>
              )}
              {!searching &&
                results.map((r) => (
                  <button
                    key={`${r.exchange}-${r.token}`}
                    type="button"
                    onClick={() => pick(r)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      width: "100%",
                      padding: "9px 12px",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                      {r.tradingSymbol.replace(/-EQ$/i, "")}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {r.symbolName}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }}>
                      {r.exchange}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
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
          fontWeight: 600,
          fontSize: 13,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Placing…" : `${side.toUpperCase()} ${symbol || "—"}`}
      </button>
    </div>
  );
}
