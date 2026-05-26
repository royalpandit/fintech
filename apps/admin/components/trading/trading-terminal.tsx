"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ChartWidget, { evalCustom } from "./chart-widget";
import type { ChartType, CustomIndicator } from "./chart-widget";
import type { Candle, CandleInterval } from "@/lib/zerodha";
import { MARKET_INSTRUMENTS } from "@/lib/zerodha";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WatchlistItem {
  display: string;
  tradingSymbol: string;
  token: string;
  exchange: string;
  type: "INDEX" | "EQ" | "FO" | string;
  ltp?: number;
  change?: number;
  changePct?: number;
  open?: number;
  high?: number;
  low?: number;
}

const PRESET_TOKENS = new Set<string>(MARKET_INSTRUMENTS.map(m => m.token));

const INTERVALS: { label: string; interval: CandleInterval }[] = [
  { label: "1m",  interval: "ONE_MINUTE"     },
  { label: "5m",  interval: "FIVE_MINUTE"    },
  { label: "15m", interval: "FIFTEEN_MINUTE" },
  { label: "30m", interval: "THIRTY_MINUTE"  },
  { label: "1h",  interval: "ONE_HOUR"       },
  { label: "1D",  interval: "ONE_DAY"        },
];

const PERIODS = [
  { label: "1D",  days: 1   },
  { label: "5D",  days: 5   },
  { label: "1M",  days: 30  },
  { label: "3M",  days: 90  },
  { label: "6M",  days: 180 },
  { label: "1Y",  days: 365 },
];

// Zerodha max days per interval — mirrors the server-side cap
const INTERVAL_MAX_DAYS: Partial<Record<CandleInterval, number>> = {
  ONE_MINUTE:     60,
  THREE_MINUTE:   100,
  FIVE_MINUTE:    100,
  TEN_MINUTE:     100,
  FIFTEEN_MINUTE: 200,
  THIRTY_MINUTE:  200,
  ONE_HOUR:       400,
  ONE_DAY:        2000,
};

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { display: "NIFTY 50",   tradingSymbol: "NIFTY 50",   token: "256265",  exchange: "NSE", type: "INDEX" },
  { display: "BANK NIFTY", tradingSymbol: "NIFTY BANK", token: "260105",  exchange: "NSE", type: "INDEX" },
  { display: "SENSEX",     tradingSymbol: "SENSEX",      token: "265",     exchange: "BSE", type: "INDEX" },
  { display: "RELIANCE",   tradingSymbol: "RELIANCE",    token: "738561",  exchange: "NSE", type: "EQ"    },
  { display: "TCS",        tradingSymbol: "TCS",         token: "2374913", exchange: "NSE", type: "EQ"    },
  { display: "HDFCBANK",   tradingSymbol: "HDFCBANK",    token: "341249",  exchange: "NSE", type: "EQ"    },
  { display: "INFY",       tradingSymbol: "INFY",        token: "408065",  exchange: "NSE", type: "EQ"    },
  { display: "ICICIBANK",  tradingSymbol: "ICICIBANK",   token: "1270529", exchange: "NSE", type: "EQ"    },
  { display: "WIPRO",      tradingSymbol: "WIPRO",       token: "3787265", exchange: "NSE", type: "EQ"    },
  { display: "SBIN",       tradingSymbol: "SBIN",        token: "779521",  exchange: "NSE", type: "EQ"    },
  { display: "BHARTIARTL", tradingSymbol: "BHARTIARTL",  token: "2714625", exchange: "NSE", type: "EQ"    },
  { display: "LT",         tradingSymbol: "LT",          token: "2939649", exchange: "NSE", type: "EQ"    },
];

// ── Drawing tools ─────────────────────────────────────────────────────────────

const DRAW_TOOLS = [
  { id: "cursor",    title: "Cursor",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 1l10 5.5-5.5 1L5 13z"/></svg> },
  { id: "crosshair", title: "Crosshair",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" fill="none"><line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/><circle cx="7" cy="7" r="2"/></svg> },
  { id: "hline",     title: "Horizontal Line",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5"><line x1="1" y1="7" x2="13" y2="7"/><circle cx="13" cy="7" r="1.5" fill="currentColor"/></svg> },
  { id: "trend",     title: "Trend Line",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="12" x2="12" y2="2"/><circle cx="2" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="2" r="1.5" fill="currentColor"/></svg> },
  { id: "vline",     title: "Vertical Line",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5"><line x1="7" y1="1" x2="7" y2="13"/><circle cx="7" cy="1" r="1.5" fill="currentColor"/></svg> },
  { id: "rect",      title: "Rectangle",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="2" y="4" width="10" height="7" rx="0.5"/></svg> },
  { id: "fib",       title: "Fibonacci",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.2" fill="none"><line x1="2" y1="3" x2="12" y2="3"/><line x1="2" y1="6" x2="10" y2="6"/><line x1="2" y1="9" x2="12" y2="9"/><line x1="2" y1="12" x2="9" y2="12"/><line x1="2" y1="3" x2="2" y2="12"/></svg> },
  { id: "text",      title: "Text",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M2 3h10v2H8.5v6h-3V5H2V3z"/></svg> },
  { id: "pencil",    title: "Pencil",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M9.5 1.5l3 3-7.5 7.5H2v-3l7.5-7.5z"/><line x1="7.5" y1="3.5" x2="10.5" y2="6.5"/></svg> },
  { id: "eraser",    title: "Eraser",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.2" fill="none"><path d="M10 2L3 9l1.5 1.5h5L12 9 10 2z"/><line x1="1" y1="12.5" x2="13" y2="12.5"/></svg> },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtP(n: number | undefined) {
  if (n === undefined || n === null) return "—";
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number | undefined) {
  if (n === undefined || n === null) return "";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

// ── Custom Indicator Modal ────────────────────────────────────────────────────

const PRESET_FORMULAS = [
  { label: "SMA(20)",   formula: "SMA(20)"                  },
  { label: "SMA(50)",   formula: "SMA(50)"                  },
  { label: "EMA(9)",    formula: "EMA(9)"                   },
  { label: "EMA(14)",   formula: "EMA(14)"                  },
  { label: "RSI(14)",   formula: "RSI(14)"                  },
  { label: "VWAP",      formula: "VWAP()"                   },
  { label: "Midpoint",  formula: "(h+l)/2"                  },
  { label: "BB Upper",  formula: "SMA(20)+STDDEV(20)*2"     },
  { label: "BB Lower",  formula: "SMA(20)-STDDEV(20)*2"     },
  { label: "Momentum",  formula: "c-EMA(20)"                },
  { label: "HL Range",  formula: "h-l"                      },
];

const IND_COLORS = ["#0ea5e9","#f59e0b","#8b5cf6","#ec4899","#ef4444","#22c55e","#14b8a6","#f97316","#64748b","#6366f1"];

function AddIndicatorModal({ onAdd, onClose, candles }: {
  onAdd: (ind: CustomIndicator) => void;
  onClose: () => void;
  candles: Candle[];
}) {
  const [name,      setName]      = useState("Custom 1");
  const [formula,   setFormula]   = useState("SMA(20)");
  const [color,     setColor]     = useState(IND_COLORS[0]);
  const [lineWidth, setLineWidth] = useState(1);
  const [lineStyle, setLineStyle] = useState(0);
  const [error,     setError]     = useState("");
  const [preview,   setPreview]   = useState<number | null>(null);

  function validate(): boolean {
    try {
      const res = evalCustom(formula, candles);
      if (!res.length) { setError("No valid values — check your formula."); setPreview(null); return false; }
      setError(""); setPreview(res[res.length - 1].value); return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setPreview(null); return false;
    }
  }

  function handleAdd() {
    if (!validate()) return;
    onAdd({ id: `ci_${Date.now()}`, name: name.trim() || "Custom", formula, color, lineWidth, lineStyle });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "24px 24px 20px", width: "min(520px,95vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Add Custom Indicator</h2>
          <button type="button" onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#64748b", padding: "0 4px" }}>×</button>
        </div>

        {/* Preset chips */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>Quick presets</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {PRESET_FORMULAS.map(pf => (
              <button key={pf.label} type="button"
                onClick={() => { setFormula(pf.formula); setName(pf.label); setError(""); setPreview(null); }}
                style={{ padding: "4px 10px", borderRadius: 20, border: "1px solid", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  borderColor: formula === pf.formula ? "#0ea5e9" : "#e2e8f0",
                  background: formula === pf.formula ? "#0ea5e9" : "#f8fafc",
                  color: formula === pf.formula ? "#fff" : "#334155" }}>
                {pf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 13 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 }}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Formula */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 }}>Formula</label>
          <textarea value={formula} rows={3}
            onChange={e => { setFormula(e.target.value); setError(""); setPreview(null); }}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, fontFamily: "monospace", color: "#0f172a", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, lineHeight: 1.7 }}>
            <b style={{ color: "#64748b" }}>Variables:</b> <code>c</code> close · <code>o</code> open · <code>h</code> high · <code>l</code> low · <code>v</code> volume<br />
            <b style={{ color: "#64748b" }}>Functions:</b> <code>SMA(n)</code> · <code>EMA(n)</code> · <code>STDDEV(n)</code> · <code>RSI(n)</code> · <code>VWAP()</code>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div style={{ padding: "8px 10px", borderRadius: 7, background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
            {error}
          </div>
        )}
        {preview !== null && !error && (
          <div style={{ padding: "8px 10px", borderRadius: 7, background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
            Last value: {preview.toFixed(2)} ✓
          </div>
        )}

        {/* Color */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>Color</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {IND_COLORS.map(col => (
              <button key={col} type="button" onClick={() => setColor(col)}
                style={{ width: 26, height: 26, borderRadius: "50%", background: col, cursor: "pointer", padding: 0,
                  border: color === col ? "3px solid #0f172a" : "2px solid transparent", outline: "none" }} />
            ))}
          </div>
        </div>

        {/* Line options */}
        <div style={{ display: "flex", gap: 20, marginBottom: 22 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Width</label>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3].map(w => (
                <button key={w} type="button" onClick={() => setLineWidth(w)}
                  style={{ width: 36, height: 28, border: "1px solid", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700,
                    borderColor: lineWidth === w ? "#0ea5e9" : "#e2e8f0",
                    background: lineWidth === w ? "rgba(14,165,233,0.1)" : "#fff",
                    color: lineWidth === w ? "#0ea5e9" : "#64748b" }}>
                  {w}px
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Style</label>
            <div style={{ display: "flex", gap: 4 }}>
              {([{ label: "—", val: 0 }, { label: "- -", val: 2 }, { label: "···", val: 3 }] as const).map(ls => (
                <button key={ls.val} type="button" onClick={() => setLineStyle(ls.val)}
                  style={{ padding: "4px 12px", border: "1px solid", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    borderColor: lineStyle === ls.val ? "#0ea5e9" : "#e2e8f0",
                    background: lineStyle === ls.val ? "rgba(14,165,233,0.1)" : "#fff",
                    color: lineStyle === ls.val ? "#0ea5e9" : "#64748b" }}>
                  {ls.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={validate}
            style={{ padding: "9px 16px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#f8fafc", color: "#0f172a" }}>
            Preview
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: "9px 16px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#f8fafc", color: "#64748b" }}>
            Cancel
          </button>
          <button type="button" onClick={handleAdd}
            style={{ padding: "9px 20px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "#0ea5e9", color: "#fff" }}>
            Add Indicator
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SearchBar ─────────────────────────────────────────────────────────────────

const EXCHANGE_COLORS: Record<string, string> = {
  NSE: "#0ea5e9", BSE: "#8b5cf6", NFO: "#f59e0b",
  MCX: "#ef4444", CDS: "#22c55e", BFO: "#f97316",
};

function ExchangeBadge({ exchange, type }: { exchange: string; type: string }) {
  const color = EXCHANGE_COLORS[exchange] ?? "#64748b";
  return (
    <span style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: `${color}18`, color }}>{exchange}</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8" }}>{type}</span>
    </span>
  );
}

function SearchBar({ onSelect }: { onSelect: (item: WatchlistItem) => void }) {
  const [q,       setQ]       = useState("");
  const [results, setResults] = useState<WatchlistItem[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    if (query.length < 1) { setResults([]); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/v1/market/search?q=${encodeURIComponent(query)}&exchange=ALL`);
      const json = await res.json();
      if (json.ok) {
        setResults(json.data.map((d: { symbolName: string; tradingSymbol: string; token: string; exchange: string; instrumentType: string }) => ({
          display:       d.symbolName || d.tradingSymbol,
          tradingSymbol: d.tradingSymbol,
          token:         d.token,
          exchange:      d.exchange,
          type:          d.instrumentType || "EQ",
        })));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(q), 300);
  }, [q, search]);

  return (
    <div style={{ position: "relative", padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "#f8fafc", border: "1px solid #eef0f4", borderRadius: 8 }}>
        {loading
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          : <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        }
        <input value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder="Search NSE, BSE, MCX, F&O…"
          style={{ border: "none", background: "transparent", outline: "none", fontSize: 12, width: "100%", color: "#0f172a" }} />
        {q && (
          <button type="button" onClick={() => { setQ(""); setResults([]); }}
            style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {open && results.length > 0 && (
        // onMouseDown preventDefault stops input blur from firing before onClick
        <div onMouseDown={e => e.preventDefault()}
          style={{ position: "absolute", top: "calc(100% - 2px)", left: 10, right: 10, background: "#fff", border: "1px solid #eef0f4", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, maxHeight: 300, overflowY: "auto" }}>
          {results.map(r => (
            <button key={`${r.exchange}:${r.token}`} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(r); setQ(""); setResults([]); setOpen(false); }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", borderBottom: "1px solid #f8fafc", textAlign: "left", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.tradingSymbol}</div>
                {r.display !== r.tradingSymbol && (
                  <div style={{ fontSize: 10, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.display}</div>
                )}
              </div>
              <ExchangeBadge exchange={r.exchange} type={r.type} />
            </button>
          ))}
        </div>
      )}
      {open && q.length > 0 && results.length === 0 && !loading && (
        <div onMouseDown={e => e.preventDefault()}
          style={{ position: "absolute", top: "calc(100% - 2px)", left: 10, right: 10, background: "#fff", border: "1px solid #eef0f4", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, padding: "14px 12px", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
          No results for &ldquo;{q}&rdquo;
        </div>
      )}
    </div>
  );
}

// ── OrderPanel ────────────────────────────────────────────────────────────────

function OrderPanel({ symbol }: { symbol: WatchlistItem }) {
  const [side,         setSide]         = useState<"BUY" | "SELL">("BUY");
  const [orderType,    setOrderType]    = useState<"MARKET" | "LIMIT" | "SL" | "SL-M">("MARKET");
  const [product,      setProduct]      = useState<"CNC" | "MIS" | "NRML">("MIS");
  const [qty,          setQty]          = useState("1");
  const [price,        setPrice]        = useState("0");
  const [triggerPrice, setTriggerPrice] = useState("0");
  const [loading,      setLoading]      = useState(false);
  const [msg,          setMsg]          = useState<{ ok: boolean; text: string } | null>(null);

  const isIndex      = symbol.type === "INDEX";
  const needsPrice   = orderType === "LIMIT" || orderType === "SL";
  const needsTrigger = orderType === "SL"    || orderType === "SL-M";

  const placeOrder = async () => {
    if (isIndex) return;
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variety:         "regular",
          tradingsymbol:   symbol.tradingSymbol,
          symboltoken:     symbol.token,
          transactiontype: side,
          exchange:        symbol.exchange,
          ordertype:       orderType,
          producttype:     product,
          duration:        "DAY",
          price:           needsPrice   ? price        : "0",
          triggerprice:    needsTrigger ? triggerPrice : "0",
          squareoff: "0", stoploss: "0", quantity: qty,
        }),
      });
      const json = await res.json();
      setMsg(json.ok
        ? { ok: true,  text: `Order placed! ID: ${json.orderId}` }
        : { ok: false, text: json.error ?? "Order failed" });
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #eef0f4" }}>
        {(["BUY", "SELL"] as const).map(s => (
          <button key={s} type="button" onClick={() => setSide(s)}
            style={{ flex: 1, padding: "10px 0", border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer",
              background: side === s ? (s === "BUY" ? "#16a34a" : "#dc2626") : "#f8fafc",
              color: side === s ? "#fff" : "#94a3b8", letterSpacing: 0.5 }}>
            {s}
          </button>
        ))}
      </div>

      {isIndex && (
        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "8px 0" }}>
          Index cannot be traded directly.
        </p>
      )}

      {!isIndex && (
        <>
          <div>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Order Type</label>
            <select value={orderType} onChange={e => setOrderType(e.target.value as typeof orderType)}
              style={{ width: "100%", marginTop: 4, padding: "7px 8px", border: "1px solid #eef0f4", borderRadius: 6, fontSize: 12, color: "#0f172a", background: "#fff", outline: "none" }}>
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit</option>
              <option value="SL">SL (Stop Loss + price)</option>
              <option value="SL-M">SL-M (Stop Loss Market)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Product</label>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {(["MIS", "CNC", "NRML"] as const).map(p => (
                <button key={p} type="button" onClick={() => setProduct(p)}
                  style={{ flex: 1, padding: "5px 0", border: "1px solid", borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: "pointer",
                    borderColor: product === p ? "#0ea5e9" : "#eef0f4",
                    background: product === p ? "rgba(14,165,233,0.08)" : "#fff",
                    color: product === p ? "#0ea5e9" : "#64748b" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Quantity</label>
            <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "7px 8px", border: "1px solid #eef0f4", borderRadius: 6, fontSize: 13, fontWeight: 700, color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
          </div>

          {needsPrice && (
            <div>
              <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Price</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                style={{ width: "100%", marginTop: 4, padding: "7px 8px", border: "1px solid #eef0f4", borderRadius: 6, fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          {needsTrigger && (
            <div>
              <label style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Trigger Price</label>
              <input type="number" value={triggerPrice} onChange={e => setTriggerPrice(e.target.value)}
                style={{ width: "100%", marginTop: 4, padding: "7px 8px", border: "1px solid #eef0f4", borderRadius: 6, fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          <button type="button" onClick={placeOrder} disabled={loading}
            style={{ padding: "11px 0", borderRadius: 8, border: "none", fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
              background: side === "BUY" ? "#16a34a" : "#dc2626", color: "#fff", opacity: loading ? 0.7 : 1, letterSpacing: 0.5 }}>
            {loading ? "Placing…" : `${side} ${symbol.display}`}
          </button>

          {msg && (
            <div style={{ padding: "8px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: msg.ok ? "#dcfce7" : "#fee2e2", color: msg.ok ? "#15803d" : "#dc2626" }}>
              {msg.text}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Terminal ─────────────────────────────────────────────────────────────

export default function TradingTerminal() {
  return <TradingTerminalInner />;
}

function TradingTerminalInner() {
  const [watchlist,       setWatchlist]       = useState<WatchlistItem[]>(DEFAULT_WATCHLIST);
  const [selected,        setSelected]        = useState<WatchlistItem>(DEFAULT_WATCHLIST[0]);
  const [interval,        setIntervalCfg]     = useState(INTERVALS[5]); // 1D default
  const [period,          setPeriod]          = useState(PERIODS[5]);   // 1Y default

  const changeInterval = useCallback((iv: typeof INTERVALS[number]) => {
    setIntervalCfg(iv);
    const max = INTERVAL_MAX_DAYS[iv.interval] ?? 60;
    setPeriod(prev => prev.days <= max ? prev : PERIODS.slice().reverse().find(p => p.days <= max) ?? PERIODS[0]);
  }, []);
  const [candles,         setCandles]         = useState<Candle[]>([]);
  const [candleLoading,   setCandleLoading]   = useState(true);
  const [tab,             setTab]             = useState<"chart" | "orders">("chart");
  const [showMA20,        setShowMA20]        = useState(true);
  const [showMA50,        setShowMA50]        = useState(true);
  const [orders,          setOrders]          = useState<Record<string, unknown>[]>([]);
  const [activeTool,      setActiveTool]      = useState("cursor");
  const [chartType,       setChartType]       = useState<ChartType>("candle");
  const [screenshotCount, setScreenshotCount] = useState(0);
  const [showIndicators,  setShowIndicators]  = useState(false);
  const [customIndicators,setCustomIndicators]= useState<CustomIndicator[]>([]);
  const [showAddIndicator,setShowAddIndicator]= useState(false);
  const [candleError,     setCandleError]     = useState<string | null>(null);
  const [liveTick,        setLiveTick]        = useState<{ price: number; time: number; seq: number } | null>(null);

  const indicatorsRef = useRef<HTMLDivElement>(null);
  // Stable ref for watchlist — avoids restarting the 10s quote poll on every watchlist change
  const watchlistRef  = useRef(watchlist);
  useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);

  // Full-bleed terminal: override shell layout
  useEffect(() => {
    document.body.classList.add("terminal-active");
    return () => document.body.classList.remove("terminal-active");
  }, []);

  // Close indicators dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (indicatorsRef.current && !indicatorsRef.current.contains(e.target as Node))
        setShowIndicators(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── 1-second live tick for the selected symbol ───────────────────────────
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    const INTERVAL_MS: Partial<Record<CandleInterval, number>> = {
      ONE_MINUTE:     60_000,
      THREE_MINUTE:   180_000,
      FIVE_MINUTE:    300_000,
      TEN_MINUTE:     600_000,
      FIFTEEN_MINUTE: 900_000,
      THIRTY_MINUTE:  1_800_000,
      ONE_HOUR:       3_600_000,
      ONE_DAY:        86_400_000,
    };

    function candleFloor(): number {
      const ms  = INTERVAL_MS[interval.interval] ?? 60_000;
      const now = Date.now();
      // For sub-day intervals: floor to interval boundary in UTC
      if (ms < 86_400_000) return Math.floor(now / ms) * (ms / 1000);
      // For 1D: Zerodha daily candles open at 09:15 IST (03:45 UTC).
      // Floor to the most recent 03:45 UTC boundary so the time matches the series.
      const DAY_OPEN_OFFSET_S = 3 * 3600 + 45 * 60; // 03:45 UTC in seconds
      const dayStartUTC = Math.floor(now / 86_400_000) * 86_400 + DAY_OPEN_OFFSET_S;
      return now / 1000 >= dayStartUTC ? dayStartUTC : dayStartUTC - 86_400;
    }

    let seq = 0;

    async function tick() {
      const s = selectedRef.current;
      seq += 1;
      const currentSeq = seq;
      try {
        const isPreset = PRESET_TOKENS.has(s.token);
        const url = isPreset
          ? `/api/v1/market/live`
          : `/api/v1/market/live?extra=${s.token}:${s.exchange}:${encodeURIComponent(s.tradingSymbol)}`;
        const res  = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) return;
        const quote = (json.data as Array<{ symbolToken: string; ltp: number; open: number; high: number; low: number; percentChange: number; netChange: number }>)
          .find(q => q.symbolToken === s.token);
        if (!quote) return;
        setSelected(prev => ({
          ...prev,
          ltp: quote.ltp, open: quote.open, high: quote.high, low: quote.low,
          change: quote.netChange, changePct: quote.percentChange,
        }));
        setLiveTick({ price: quote.ltp, time: candleFloor(), seq: currentSeq });
      } catch { /* ignore network blips */ }
    }

    tick();
    const id = setInterval(tick, 2_000); // 2s — live feel without hammering the API
    return () => clearInterval(id);
  }, [selected.token, selected.exchange, selected.tradingSymbol, interval.interval]);

  // ── Live quote poll (5s) — keeps watchlist prices fresh ──────────────────
  // Stable callback: reads watchlist via ref — no dependency on watchlist state
  const fetchQuotes = useCallback(async () => {
    try {
      const extras = watchlistRef.current
        .filter(w => !PRESET_TOKENS.has(w.token))
        .map(w => `${w.token}:${w.exchange}:${encodeURIComponent(w.tradingSymbol)}`);
      const url = extras.length
        ? `/api/v1/market/live?extra=${extras.join(",")}`
        : "/api/v1/market/live";
      const res  = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) return;
      const quoteMap = new Map<string, { ltp: number; open: number; high: number; low: number; percentChange: number; netChange: number }>(
        json.data.map((q: { symbolToken: string; ltp: number; open: number; high: number; low: number; percentChange: number; netChange: number }) => [q.symbolToken, q])
      );
      setWatchlist(prev => prev.map(item => {
        const q = quoteMap.get(item.token);
        return q ? { ...item, ltp: q.ltp, open: q.open, high: q.high, low: q.low, change: q.netChange, changePct: q.percentChange } : item;
      }));
      setSelected(prev => {
        const q = quoteMap.get(prev.token);
        return q ? { ...prev, ltp: q.ltp, open: q.open, high: q.high, low: q.low, change: q.netChange, changePct: q.percentChange } : prev;
      });
    } catch { /* ignore */ }
  }, []); // stable — reads watchlist via ref

  useEffect(() => {
    fetchQuotes();
    const id = setInterval(fetchQuotes, 5_000);
    return () => clearInterval(id);
  }, [fetchQuotes]);

  // Reset live tick on symbol / interval change
  useEffect(() => { setLiveTick(null); }, [selected.token, interval.interval]);

  // ── Candle fetch ──────────────────────────────────────────────────────────
  const fetchCandles = useCallback(async () => {
    setCandleLoading(true);
    setCandles([]);
    setCandleError(null);
    const url = `/api/v1/market/candles?token=${selected.token}&exchange=${selected.exchange}&interval=${interval.interval}&days=${period.days}`;
    console.log("[fetchCandles] →", url);
    try {
      const res  = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      console.log("[fetchCandles] ←", json);
      if (json.ok) setCandles(json.data ?? []);
      else setCandleError(json.error ?? "Failed to load chart data");
    } catch (e) {
      console.error("[fetchCandles] network error", e);
      setCandleError(e instanceof Error ? e.message : "Network error");
    }
    finally { setCandleLoading(false); }
  }, [selected.token, selected.exchange, interval, period]);

  useEffect(() => { fetchCandles(); }, [fetchCandles]);

  // ── Intraday candle refetch: new candles form during the session ──────────
  useEffect(() => {
    const intraday = ["ONE_MINUTE","FIVE_MINUTE","FIFTEEN_MINUTE","THIRTY_MINUTE","ONE_HOUR"];
    if (!intraday.includes(interval.interval)) return;
    const refetchMs =
      interval.interval === "ONE_MINUTE"    ? 60_000  :
      interval.interval === "FIVE_MINUTE"   ? 120_000 :
      interval.interval === "FIFTEEN_MINUTE"? 180_000 : 300_000;
    const id = setInterval(fetchCandles, refetchMs);
    return () => clearInterval(id);
  }, [interval.interval, fetchCandles]);

  // ── Orders tab ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const res  = await fetch("/api/v1/orders");
      const json = await res.json();
      if (json.ok) setOrders(json.data ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (tab === "orders") fetchOrders(); }, [tab, fetchOrders]);

  const addToWatchlist = (item: WatchlistItem) => {
    if (watchlist.some(w => w.token === item.token)) { setSelected(item); return; }
    setWatchlist(prev => [...prev, item]);
    setSelected(item);
  };

  const last = candles[candles.length - 1];
  const up   = (selected.changePct ?? 0) >= 0;

  return (
    <div className="trading-terminal">

      {/* ── LEFT: Watchlist ──────────────────────────────────────────────── */}
      <div style={{ width: 220, minWidth: 220, background: "#fff", borderRight: "1px solid #eef0f4", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 12px 0", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase", paddingBottom: 8 }}>Watchlist</div>
        </div>

        <SearchBar onSelect={addToWatchlist} />

        <div style={{ flex: 1, overflowY: "auto" }}>
          {watchlist.map(item => {
            const active = item.token === selected.token;
            const pos    = (item.changePct ?? 0) >= 0;
            return (
              <button key={item.token} type="button" onClick={() => setSelected(item)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 14px", border: "none",
                  background: active ? "rgba(14,165,233,0.07)" : "transparent", cursor: "pointer",
                  borderLeft: active ? "3px solid #0ea5e9" : "3px solid transparent",
                  textAlign: "left", borderBottom: "1px solid #f8fafc" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{item.display}</div>
                  <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 500 }}>{item.exchange} · {item.type}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                    {item.ltp ? `₹${item.ltp.toLocaleString("en-IN")}` : "—"}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: pos ? "#16a34a" : "#dc2626" }}>
                    {fmtPct(item.changePct)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── DRAWING TOOLS ─────────────────────────────────────────────────── */}
      <div style={{ width: 38, background: "#fff", borderRight: "1px solid #eef0f4", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, gap: 2, flexShrink: 0 }}>
        {DRAW_TOOLS.map(tool => (
          <button key={tool.id} type="button" title={tool.title} onClick={() => setActiveTool(tool.id)}
            style={{ width: 30, height: 30, border: "none", borderRadius: 6, cursor: "pointer",
              background: activeTool === tool.id ? "rgba(14,165,233,0.12)" : "transparent",
              color: activeTool === tool.id ? "#0ea5e9" : "#64748b",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            {tool.icon}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button type="button" title="Settings" style={{ width: 30, height: 30, border: "none", borderRadius: 6, cursor: "pointer", background: "transparent", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </button>
      </div>

      {/* ── CENTER: Chart area ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Symbol header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #eef0f4", padding: "8px 16px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{selected.display}</span>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, background: "#f1f5f9", padding: "1px 6px", borderRadius: 4 }}>{selected.exchange} · {selected.type}</span>
          </div>
          {selected.ltp !== undefined && (
            <>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
                ₹{selected.ltp.toLocaleString("en-IN")}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: up ? "#16a34a" : "#dc2626" }}>
                {up ? "▲" : "▼"} {fmtPct(selected.changePct)}
                <span style={{ fontWeight: 500, marginLeft: 4, color: "#64748b" }}>({up ? "+" : ""}{fmtP(selected.change)})</span>
              </span>
            </>
          )}
          {last && (
            <div style={{ display: "flex", gap: 10, marginLeft: "auto", fontSize: 11, color: "#64748b" }}>
              {(["O", "H", "L", "C"] as const).map((l, idx) => (
                <span key={l}><b style={{ color: "#0f172a" }}>{l}</b> {fmtP([last.open, last.high, last.low, last.close][idx])}</span>
              ))}
              <span><b style={{ color: "#0f172a" }}>Vol</b> {Number(last.volume).toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #eef0f4", padding: "0 16px", display: "flex", alignItems: "center", flexShrink: 0 }}>
          {(["chart", "orders"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              style={{ padding: "9px 14px", border: "none", background: "transparent", fontWeight: 700, fontSize: 12, cursor: "pointer",
                color: tab === t ? "#0ea5e9" : "#64748b",
                borderBottom: tab === t ? "2px solid #0ea5e9" : "2px solid transparent",
                textTransform: "capitalize", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
              {t === "orders" ? "Order Book" : "Chart"}
            </button>
          ))}

          {tab === "chart" && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3 }}>
              {/* Interval pills */}
              {INTERVALS.map(iv => (
                <button key={iv.label} type="button" onClick={() => changeInterval(iv)}
                  style={{ padding: "3px 8px", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: interval.label === iv.label ? "rgba(14,165,233,0.12)" : "transparent",
                    color: interval.label === iv.label ? "#0ea5e9" : "#94a3b8" }}>
                  {iv.label}
                </button>
              ))}

              <div style={{ width: 1, height: 16, background: "#eef0f4", margin: "0 4px" }} />

              {/* Indicators dropdown */}
              <div style={{ position: "relative" }} ref={indicatorsRef}>
                <button type="button" onClick={() => setShowIndicators(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1px solid #eef0f4", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: showIndicators ? "#f0f9ff" : "#fff", color: "#0f172a" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Indicators {customIndicators.length > 0 && <span style={{ background: "#0ea5e9", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{customIndicators.length}</span>}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {showIndicators && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #eef0f4", borderRadius: 10, padding: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 220 }}>

                    {/* Built-in MAs */}
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>Moving Averages</div>
                    {[
                      { label: "MA 20", active: showMA20, toggle: () => setShowMA20(v => !v), color: "#f59e0b" },
                      { label: "MA 50", active: showMA50, toggle: () => setShowMA50(v => !v), color: "#8b5cf6" },
                    ].map(ind => (
                      <button key={ind.label} type="button" onClick={ind.toggle}
                        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "7px 4px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", borderRadius: 6 }}>
                        <span style={{ width: 24, height: 3, borderRadius: 2, background: ind.active ? ind.color : "#e2e8f0", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", flex: 1 }}>{ind.label}</span>
                        <span style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${ind.active ? ind.color : "#d1d5db"}`, background: ind.active ? ind.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {ind.active && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2"><polyline points="1.5 5 4 7.5 8.5 2"/></svg>}
                        </span>
                      </button>
                    ))}

                    {/* Custom indicators list */}
                    {customIndicators.length > 0 && (
                      <>
                        <div style={{ borderTop: "1px solid #f1f5f9", margin: "10px 0 8px", paddingTop: 8, fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 0.6, textTransform: "uppercase" }}>Custom</div>
                        {customIndicators.map(ci => (
                          <div key={ci.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", borderRadius: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: ci.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ci.name}</span>
                            <button type="button" onClick={() => setCustomIndicators(prev => prev.filter(c => c.id !== ci.id))}
                              style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>×</button>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Add custom indicator */}
                    <button type="button"
                      onClick={() => { setShowIndicators(false); setShowAddIndicator(true); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", marginTop: 10, padding: "8px 10px", border: "1px dashed #0ea5e9", borderRadius: 7, background: "rgba(14,165,233,0.04)", color: "#0ea5e9", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add Custom Indicator
                    </button>
                  </div>
                )}
              </div>

              {/* Chart type icons */}
              <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
                {([
                  { id: "candle" as ChartType, title: "Candlestick", icon: <svg width="13" height="13" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="2" y="4" width="3" height="5" rx="0.5"/><line x1="3.5" y1="1" x2="3.5" y2="4"/><line x1="3.5" y1="9" x2="3.5" y2="13"/><rect x="9" y="5" width="3" height="4" rx="0.5" fill="currentColor"/><line x1="10.5" y1="2" x2="10.5" y2="5"/><line x1="10.5" y1="9" x2="10.5" y2="12"/></svg> },
                  { id: "bar"    as ChartType, title: "Bar chart",    icon: <svg width="13" height="13" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" fill="none"><line x1="3" y1="1" x2="3" y2="13"/><line x1="1" y1="5" x2="3" y2="5"/><line x1="3" y1="9" x2="5" y2="9"/><line x1="10" y1="2" x2="10" y2="14"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="10" y1="10" x2="12" y2="10"/></svg> },
                  { id: "line"   as ChartType, title: "Line chart",   icon: <svg width="13" height="13" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" fill="none"><polyline points="1,11 4,6 7,8 10,3 13,5"/></svg> },
                ] as { id: ChartType; title: string; icon: React.ReactNode }[]).map(ct => (
                  <button key={ct.id} type="button" title={ct.title} onClick={() => setChartType(ct.id)}
                    style={{ width: 26, height: 26, border: "1px solid", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      borderColor: chartType === ct.id ? "#0ea5e9" : "#eef0f4",
                      background: chartType === ct.id ? "rgba(14,165,233,0.1)" : "#fff",
                      color: chartType === ct.id ? "#0ea5e9" : "#64748b" }}>
                    {ct.icon}
                  </button>
                ))}
              </div>

              {/* Screenshot */}
              <button type="button" title="Save chart as PNG" onClick={() => setScreenshotCount(c => c + 1)}
                style={{ width: 26, height: 26, border: "1px solid #eef0f4", borderRadius: 5, background: "#fff", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 2 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Chart / Order Book body */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {tab === "chart" ? (
            <>
              <div style={{ flex: 1, position: "relative", margin: "8px 16px 0", overflow: "hidden" }}>
                {candleLoading ? (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 13 }}>
                    Loading chart data…
                  </div>
                ) : candleError ? (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="#dc2626"/></svg>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", textAlign: "center", maxWidth: 360 }}>{candleError}</div>
                    {/api_key|access_token|token|auth|authenticate/i.test(candleError) ? (
                      <a href="/api/v1/auth/zerodha/login"
                        style={{ marginTop: 4, padding: "9px 20px", background: "#387ed1", color: "#fff", borderRadius: 8, fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
                        Re-login with Zerodha
                      </a>
                    ) : (
                      <button type="button" onClick={fetchCandles}
                        style={{ marginTop: 4, padding: "7px 16px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#f8fafc", color: "#0f172a" }}>
                        Retry
                      </button>
                    )}
                  </div>
                ) : (
                  <ChartWidget
                    candles={candles}
                    showMA20={showMA20}
                    showMA50={showMA50}
                    chartType={chartType}
                    activeTool={activeTool}
                    livePrice={liveTick?.price ?? selected.ltp}
                    liveTimestamp={liveTick?.time}
                    liveSeq={liveTick?.seq}
                    screenshotTrigger={screenshotCount}
                    customIndicators={customIndicators}
                  />
                )}
              </div>

              {/* Period selector — only show periods within the interval's max-day limit */}
              <div style={{ background: "#fff", borderTop: "1px solid #eef0f4", display: "flex", alignItems: "center", padding: "4px 16px", gap: 2, flexShrink: 0 }}>
                {PERIODS.filter(p => p.days <= (INTERVAL_MAX_DAYS[interval.interval] ?? 2000)).map(p => (
                  <button key={p.label} type="button" onClick={() => setPeriod(p)}
                    style={{ padding: "3px 10px", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      background: period.label === p.label ? "rgba(14,165,233,0.12)" : "transparent",
                      color: period.label === p.label ? "#0ea5e9" : "#64748b" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Order Book ({orders.length})</h3>
                <button type="button" onClick={fetchOrders} style={{ fontSize: 11, color: "#0ea5e9", border: "none", background: "transparent", cursor: "pointer", fontWeight: 600 }}>↺ Refresh</button>
              </div>
              {orders.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No orders today.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Time","Symbol","Type","Qty","Price","Status"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #eef0f4" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o, i) => {
                        const ord = o as Record<string, string>;
                        const isBuy = ord.transactiontype === "BUY";
                        const sc = ord.status === "complete" ? "#16a34a" : ord.status === "rejected" ? "#dc2626" : "#f59e0b";
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: "#64748b" }}>{ord.updatetime?.slice(0, 8) ?? "—"}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: "#0f172a" }}>{ord.tradingsymbol}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: isBuy ? "#16a34a" : "#dc2626" }}>{ord.transactiontype}</td>
                            <td style={{ padding: "10px 12px" }}>{ord.quantity}</td>
                            <td style={{ padding: "10px 12px" }}>₹{Number(ord.price ?? 0).toLocaleString("en-IN")}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 999, background: `${sc}18`, color: sc, fontSize: 10, fontWeight: 700, textTransform: "capitalize" }}>{ord.status ?? "—"}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Order Panel ─────────────────────────────────────────────── */}
      <div style={{ width: 226, minWidth: 226, background: "#fff", borderLeft: "1px solid #eef0f4", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase" }}>Place Order</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <OrderPanel symbol={selected} />
        </div>
      </div>

      {/* ── Custom Indicator Modal ─────────────────────────────────────────── */}
      {showAddIndicator && (
        <AddIndicatorModal
          candles={candles}
          onAdd={ind => { setCustomIndicators(prev => [...prev, ind]); setShowAddIndicator(false); }}
          onClose={() => setShowAddIndicator(false)}
        />
      )}
    </div>
  );
}
