"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import ChartWidget, { evalCustom, OI_PROFILE_INDICATOR_ID } from "./chart-widget";
import type { OptionChainData } from "./option-chain-panel";
import type { OptionLeg, Candle, CandleInterval } from "@/lib/angelone-types";
import { optionUnderlyingKey, MARKET_INSTRUMENTS, resolveMarketExchange } from "@/lib/angelone-shared";
import type { ChartType, CustomIndicator } from "./chart-widget";
import OptionChainPanel from "./option-chain-panel";
import TradingUtilityShell from "./trading-utility-shell";
import { allWatchlistItems, refresh, useWatchlistStore } from "@/lib/watchlist-store";
import type { UtilityPanelId } from "./trading-utility-types";
import type { WatchlistItem } from "./trading-terminal-types";
import {
  DEFAULT_TIMEFRAME,
  defaultPeriodForTimeframe,
  defaultVisibleBars,
  isIntradayTimeframe,
  maxDaysForTimeframe,
  type IndicatorDefinition,
  type PeriodPreset,
  type TimeframeOption,
} from "./chart-config";
import { applyTimeframePipeline } from "./chart-transforms";
import { applyLiveQuoteToCandles, liveHeaderOhlc } from "@/lib/live-candle";
import { BUILTIN_INDICATOR_IDS, runIndicatorEngine } from "@/lib/indicators";
import { nseLiveCandleOpenUnix } from "@/lib/nse-market-time";
import { useMarketStream } from "@/hooks/use-market-stream";
import {
  matchPendingPaperOrders,
  paperSymbolFromWatchlist,
} from "@/lib/paper-trade-client";
import {
  ChartTypeMenu,
  IndicatorsModal,
  TimeframeMenu,
  chartTypeLabel,
  indicatorToCustom,
  timeframeLabel,
} from "./chart-menus";

export type { WatchlistItem };

type CenterTab = "chart" | "overview" | "option-chain";

const PRESET_TOKENS = new Set<string>(MARKET_INSTRUMENTS.map(m => m.token));

const PERIODS: PeriodPreset[] = [
  { label: "1D",  days: 1   },
  { label: "5D",  days: 5   },
  { label: "10D", days: 10  },
  { label: "1M",  days: 30  },
  { label: "3M",  days: 90  },
  { label: "6M",  days: 180 },
  { label: "1Y",  days: 365 },
  { label: "All", days: 2000 },
];

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { display: "NIFTY 50",   tradingSymbol: "NIFTY 50",   token: "99926000", exchange: "NSE", type: "INDEX" },
  { display: "BANK NIFTY", tradingSymbol: "NIFTY BANK", token: "99926009", exchange: "NSE", type: "INDEX" },
  { display: "SENSEX",     tradingSymbol: "SENSEX",      token: "99919000", exchange: "BSE", type: "INDEX" },
  { display: "RELIANCE",   tradingSymbol: "RELIANCE",    token: "2885",     exchange: "NSE", type: "EQ"    },
  { display: "TCS",        tradingSymbol: "TCS",         token: "11536",    exchange: "NSE", type: "EQ"    },
  { display: "HDFCBANK",   tradingSymbol: "HDFCBANK",    token: "1333",     exchange: "NSE", type: "EQ"    },
  { display: "INFY",       tradingSymbol: "INFY",        token: "1594",     exchange: "NSE", type: "EQ"    },
  { display: "ICICIBANK",  tradingSymbol: "ICICIBANK",   token: "4963",     exchange: "NSE", type: "EQ"    },
  { display: "WIPRO",      tradingSymbol: "WIPRO",       token: "3787",     exchange: "NSE", type: "EQ"    },
  { display: "SBIN",       tradingSymbol: "SBIN",        token: "3045",     exchange: "NSE", type: "EQ"    },
  { display: "BHARTIARTL", tradingSymbol: "BHARTIARTL",  token: "10604",    exchange: "NSE", type: "EQ"    },
  { display: "LT",         tradingSymbol: "LT",          token: "11483",    exchange: "NSE", type: "EQ"    },
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

// ── Overview / Option chain panels ────────────────────────────────────────────

function OverviewPanel({
  symbol,
  candles,
  loading,
}: {
  symbol: WatchlistItem;
  candles: Candle[];
  loading: boolean;
}) {
  const last = candles[candles.length - 1];
  const first = candles[0];
  const dayChange =
    first && last ? ((last.close - first.open) / first.open) * 100 : null;
  const up = (symbol.changePct ?? dayChange ?? 0) >= 0;

  const stats = [
    { label: "LTP", value: symbol.ltp !== undefined ? fmtP(symbol.ltp) : "—" },
    { label: "Open", value: symbol.open !== undefined ? fmtP(symbol.open) : last ? fmtP(last.open) : "—" },
    { label: "High", value: symbol.high !== undefined ? fmtP(symbol.high) : last ? fmtP(last.high) : "—" },
    { label: "Low", value: symbol.low !== undefined ? fmtP(symbol.low) : last ? fmtP(last.low) : "—" },
    { label: "Prev. Close", value: last ? fmtP(last.close) : "—" },
    { label: "Volume", value: last ? Number(last.volume).toLocaleString("en-IN") : "—" },
    { label: "Change", value: symbol.change !== undefined ? fmtP(symbol.change) : "—" },
    { label: "Change %", value: symbol.changePct !== undefined ? fmtPct(symbol.changePct) : dayChange !== null ? fmtPct(dayChange) : "—" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{symbol.display}</h3>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {symbol.exchange} · {symbol.type} · Token {symbol.token}
        </div>
        {symbol.ltp !== undefined && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{fmtP(symbol.ltp)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: up ? "#16a34a" : "#dc2626" }}>
              {up ? "▲" : "▼"} {fmtPct(symbol.changePct ?? dayChange ?? undefined)}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading overview…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: "#f8fafc", border: "1px solid #eef0f4", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
        Live quote via Angel One SmartAPI. Select a symbol from search to update chart, overview, and option chain together.
      </p>
    </div>
  );
}

// ── Main Terminal ─────────────────────────────────────────────────────────────

export default function TradingTerminal() {
  return <TradingTerminalInner />;
}

function TradingTerminalInner() {
  const router = useRouter();
  const { lists: storeLists, version: storeVersion } = useWatchlistStore();
  const [watchlist,       setWatchlist]       = useState<WatchlistItem[]>(DEFAULT_WATCHLIST);
  const [selected,        setSelected]        = useState<WatchlistItem>(DEFAULT_WATCHLIST[0]);
  const [timeframe,       setTimeframe]       = useState<TimeframeOption>(DEFAULT_TIMEFRAME);
  const [period,          setPeriod]          = useState(() => defaultPeriodForTimeframe(DEFAULT_TIMEFRAME));
  const [showTfMenu,      setShowTfMenu]      = useState(false);
  const [showChartMenu,   setShowChartMenu]   = useState(false);
  const [showIndModal,    setShowIndModal]    = useState(false);
  const [activeIndicatorIds, setActiveIndicatorIds] = useState<Set<string>>(new Set());

  const changeTimeframe = useCallback((tf: TimeframeOption) => {
    setTimeframe(tf);
    const max = maxDaysForTimeframe(tf);
    const def = defaultPeriodForTimeframe(tf);
    setPeriod(prev => {
      if (prev.days > max) {
        return PERIODS.slice().reverse().find(p => p.days <= max) ?? PERIODS[0];
      }
      // Switching to intraday with a multi-month window loads too many bars — use sensible default.
      if (isIntradayTimeframe(tf) && prev.days > def.days * 2) return def;
      return prev;
    });
  }, []);
  const [candles,         setCandles]         = useState<Candle[]>([]);
  const [candleLoading,   setCandleLoading]   = useState(true);
  const [centerTab,       setCenterTab]       = useState<CenterTab>("chart");
  const [orders,          setOrders]          = useState<
    { symbol: string; side: string; quantity: number; price: number }[]
  >([]);
  const [activeTool,      setActiveTool]      = useState("cursor");
  const [chartType,       setChartType]       = useState<ChartType>("candle");
  const [screenshotCount, setScreenshotCount] = useState(0);
  const [customIndicators,setCustomIndicators]= useState<CustomIndicator[]>([]);
  const [showAddIndicator,setShowAddIndicator]= useState(false);
  const [candleError,     setCandleError]     = useState<string | null>(null);
  const [liveTick,        setLiveTick]        = useState<{ price: number; time: number; seq: number } | null>(null);
  const [liveSessionVol,  setLiveSessionVol]  = useState<number | undefined>(undefined);
  const [mobilePanel,     setMobilePanel]     = useState<"chart" | "utility">("chart");
  const [utilityPanel,    setUtilityPanel]    = useState<UtilityPanelId | null>(null);
  const [orderSide,       setOrderSide]       = useState<"BUY" | "SELL">("BUY");
  const [paperRefreshKey, setPaperRefreshKey] = useState(0);
  const paperMatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchlistForMatchRef = useRef(watchlist);
  watchlistForMatchRef.current = watchlist;

  const toolbarRef = useRef<HTMLDivElement>(null);
  // Stable ref for watchlist — avoids restarting the 10s quote poll on every watchlist change
  const watchlistRef  = useRef(watchlist);
  useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);

  // Full-bleed terminal: override shell layout
  useEffect(() => {
    document.body.classList.add("terminal-active");
    return () => document.body.classList.remove("terminal-active");
  }, []);

  // Close toolbar menus on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowTfMenu(false);
        setShowChartMenu(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggleCatalogIndicator = useCallback((def: IndicatorDefinition) => {
    setActiveIndicatorIds(prev => {
      const next = new Set(prev);
      if (next.has(def.id)) {
        next.delete(def.id);
        if (!def.builtin) {
          setCustomIndicators(ci => ci.filter(c => c.id !== def.id));
        }
      } else {
        next.add(def.id);
        if (!def.builtin) {
          setCustomIndicators(ci => [...ci.filter(c => c.id !== def.id), indicatorToCustom(def)]);
        }
      }
      return next;
    });
  }, []);

  // ── Live: WebSocket LTP (SSE) + slow REST OHLC fallback for watchlist ──
  const selectedRef = useRef(selected);
  const centerTabRef = useRef(centerTab);
  const liveSeqRef = useRef(0);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { centerTabRef.current = centerTab; }, [centerTab]);

  const candleFloor = useCallback(
    () => nseLiveCandleOpenUnix(timeframe.fetchInterval, timeframe.aggregate ?? 1),
    [timeframe.fetchInterval, timeframe.aggregate],
  );

  const pushLiveTick = useCallback(
    (ltp: number, sessionVolume?: number) => {
      liveSeqRef.current += 1;
      setLiveTick({ price: ltp, time: candleFloor(), seq: liveSeqRef.current });
      if (sessionVolume != null && sessionVolume > 0) setLiveSessionVol(sessionVolume);
    },
    [candleFloor],
  );

  const schedulePaperOrderMatch = useCallback(() => {
    if (paperMatchTimerRef.current) clearTimeout(paperMatchTimerRef.current);
    paperMatchTimerRef.current = setTimeout(async () => {
      const quotes = watchlistForMatchRef.current
        .filter(w => w.ltp && w.ltp > 0)
        .map(w => ({ symbol: paperSymbolFromWatchlist(w), ltp: w.ltp! }));
      const sel = selectedRef.current;
      if (sel.ltp && sel.ltp > 0) {
        quotes.push({ symbol: paperSymbolFromWatchlist(sel), ltp: sel.ltp });
      }
      if (!quotes.length) return;
      const matched = await matchPendingPaperOrders(quotes);
      if (matched > 0) setPaperRefreshKey(k => k + 1);
    }, 1500);
  }, []);

  const fetchQuotes = useCallback(async () => {
    try {
      const extras = watchlistRef.current
        .filter(w => !PRESET_TOKENS.has(w.token))
        .map(w =>
          `${w.token}:${w.exchange}:${encodeURIComponent(w.tradingSymbol)}:${encodeURIComponent(w.type)}`
        );
      const url = extras.length
        ? `/api/v1/market/live?extra=${extras.join(",")}`
        : "/api/v1/market/live";
      const res  = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.rateLimited) {
        setCandleError(prev =>
          prev?.includes("rate limit") ? prev : "Angel One rate limit — live updates paused briefly."
        );
        return;
      }
      if (!json.ok) return;

      const quoteMap = new Map<string, {
        ltp: number; open: number; high: number; low: number;
        percentChange: number; netChange: number;
        tradeVolume?: number; volume?: number;
      }>(
        json.data.map((q: {
          symbolToken: string; ltp: number; open: number; high: number; low: number;
          percentChange: number; netChange: number;
          tradeVolume?: number; volume?: number;
        }) => [q.symbolToken, q])
      );

      setWatchlist(prev => prev.map(item => {
        const q = quoteMap.get(item.token);
        return q ? { ...item, ltp: q.ltp, open: q.open, high: q.high, low: q.low, change: q.netChange, changePct: q.percentChange } : item;
      }));

      const matchQuotes: { symbol: string; ltp: number }[] = [];
      for (const item of watchlistRef.current) {
        const q = quoteMap.get(item.token);
        if (q?.ltp && q.ltp > 0) {
          matchQuotes.push({ symbol: paperSymbolFromWatchlist(item), ltp: q.ltp });
        }
      }

      const sel = selectedRef.current;
      const q = quoteMap.get(sel.token);
      if (q) {
        const liveVol = Number(q.tradeVolume ?? q.volume) || undefined;
        setSelected(prev => ({
          ...prev,
          ltp: q.ltp, open: q.open, high: q.high, low: q.low,
          change: q.netChange, changePct: q.percentChange,
        }));
        pushLiveTick(q.ltp, liveVol);
        setCandleError(prev =>
          prev?.includes("rate limit") ? null : prev
        );
        const sq = quoteMap.get(sel.token);
        if (sq?.ltp && sq.ltp > 0) {
          matchQuotes.push({ symbol: paperSymbolFromWatchlist(sel), ltp: sq.ltp });
        }
      }

      if (matchQuotes.length) {
        const matched = await matchPendingPaperOrders(matchQuotes);
        if (matched > 0) {
          setPaperRefreshKey(k => k + 1);
        }
      }
    } catch { /* ignore */ }
  }, [pushLiveTick]);

  // ── Angel WebSocket (one SSE → one server WS) for LTP ticks ───────────────
  const streamSymbols = useMemo(() => {
    const keys = new Set<string>();
    const add = (exchange: string, token: string) => {
      if (token) keys.add(`${exchange}:${token}`);
    };
    add(resolveMarketExchange({
      exchange: selected.exchange,
      symboltoken: selected.token,
      tradingSymbol: selected.tradingSymbol,
      instrumentType: selected.type,
    }), selected.token);
    for (const w of watchlist) {
      add(resolveMarketExchange({
        exchange: w.exchange,
        symboltoken: w.token,
        tradingSymbol: w.tradingSymbol,
        instrumentType: w.type,
      }), w.token);
    }
    return [...keys];
  }, [selected.token, selected.exchange, selected.tradingSymbol, selected.type, watchlist]);

  const handleStreamTick = useCallback(
    (tick: { token: string; exchange: string; ltp: number; volume?: number }) => {
      const ltp = tick.ltp;
      if (!Number.isFinite(ltp) || ltp <= 0) return;

      setWatchlist(prev =>
        prev.map(item =>
          item.token === tick.token
            ? { ...item, ltp }
            : item,
        ),
      );

      const sel = selectedRef.current;
      if (sel.token === tick.token) {
        setSelected(prev => ({ ...prev, ltp }));
        pushLiveTick(ltp, tick.volume);
        setCandleError(prev => (prev?.includes("rate limit") ? null : prev));
      }

      schedulePaperOrderMatch();
    },
    [pushLiveTick, schedulePaperOrderMatch],
  );

  useMarketStream(streamSymbols, handleStreamTick, centerTab === "chart" && !candleLoading);

  // REST fallback for OHLC / % change on watchlist (WebSocket = LTP only)
  useEffect(() => {
    fetchQuotes();
    const ms = centerTab === "chart" ? 12_000 : 20_000;
    const id = setInterval(fetchQuotes, ms);
    return () => clearInterval(id);
  }, [fetchQuotes, centerTab]);

  // Reset live tick on symbol / interval change
  useEffect(() => {
    setLiveTick(null);
    setLiveSessionVol(undefined);
  }, [selected.token, timeframe.id]);

  // ── Candle fetch (silent refresh keeps chart visible) ─────────────────────
  const fetchCandles = useCallback(async (silent = false) => {
    if (!silent) {
      setCandleLoading(true);
      setCandles([]);
      setCandleError(null);
    }
    const url =
      `/api/v1/market/candles?token=${selected.token}` +
      `&exchange=${encodeURIComponent(selected.exchange)}` +
      `&tradingSymbol=${encodeURIComponent(selected.tradingSymbol)}` +
      `&instrumentType=${encodeURIComponent(selected.type)}` +
      `&interval=${timeframe.fetchInterval}&days=${period.days}`;
    try {
      const res  = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setCandles(json.data as Candle[]);
        const ltp = selectedRef.current.ltp;
        if (ltp && ltp > 0) pushLiveTick(ltp, liveSessionVol);
        if (!silent) setCandleError(null);
      } else if (!silent) {
        setCandleError(json.error ?? "Failed to load chart data");
      }
    } catch (e) {
      if (!silent) {
        setCandleError(e instanceof Error ? e.message : "Network error");
      }
    } finally {
      if (!silent) setCandleLoading(false);
    }
  }, [selected.token, selected.exchange, selected.tradingSymbol, selected.type, timeframe.fetchInterval, period, pushLiveTick, liveSessionVol]);

  const displayCandles = useMemo(() => {
    const piped = applyTimeframePipeline(candles, timeframe.aggregate);
    if (!liveTick?.price || piped.length === 0) return piped;
    return applyLiveQuoteToCandles(piped, {
      ltp: liveTick.price,
      bucketOpenUnix: liveTick.time,
      sessionVolume: liveSessionVol,
    });
  }, [candles, timeframe.aggregate, liveTick, liveSessionVol]);

  const chartViewportKey = useMemo(
    () => `${selected.token}:${timeframe.id}:${period.days}`,
    [selected.token, timeframe.id, period.days],
  );

  const chartVisibleBars = useMemo(() => defaultVisibleBars(timeframe), [timeframe]);

  const chartIndicators = useMemo(
    () => runIndicatorEngine(displayCandles, activeIndicatorIds),
    [displayCandles, activeIndicatorIds, liveTick?.seq],
  );

  const formulaCustomIndicators = useMemo(
    () => customIndicators.filter(ci => !BUILTIN_INDICATOR_IDS.has(ci.id) && ci.id !== OI_PROFILE_INDICATOR_ID),
    [customIndicators],
  );

  const oiProfileActive = activeIndicatorIds.has(OI_PROFILE_INDICATOR_ID);
  const oiUnderlying = useMemo(
    () => optionUnderlyingKey(selected.tradingSymbol, selected.display),
    [selected.tradingSymbol, selected.display],
  );

  const [oiChain, setOiChain] = useState<OptionChainData | null>(null);
  const [oiExpiry, setOiExpiry] = useState<string | undefined>();
  const [oiError, setOiError] = useState<string | null>(null);
  const oiChainRef = useRef<OptionChainData | null>(null);
  const oiPrevOiRef = useRef<Map<string, number>>(new Map());
  const [oiRefreshKey, setOiRefreshKey] = useState(0);

  const loadOiProfile = useCallback(async (expiryCode?: string, silent = false) => {
    if (!oiUnderlying) {
      setOiChain(null);
      setOiError("No option chain for this symbol.");
      return;
    }
    if (!silent) setOiError(null);
    try {
      const params = new URLSearchParams({
        symbol: selected.tradingSymbol,
        display: selected.display,
        profile: "1",
      });
      const ltp = selected.ltp ?? liveTick?.price;
      if (ltp) params.set("ltp", String(ltp));
      if (expiryCode) params.set("expiry", expiryCode);

      const res = await fetch(`/api/v1/market/option-chain?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        const data = json.data as OptionChainData;
        data.spot = ltp ?? data.spot;
        setOiChain(data);
        setOiExpiry(data.expiry);
        oiChainRef.current = data;
        oiPrevOiRef.current.clear();
        for (const row of data.rows) {
          if (row.ce?.oi) oiPrevOiRef.current.set(row.ce.token, row.ce.oi);
          if (row.pe?.oi) oiPrevOiRef.current.set(row.pe.token, row.pe.oi);
        }
        setOiRefreshKey(k => k + 1);
      } else if (!silent) {
        setOiChain(null);
        setOiError(json.error ?? "Failed to load OI profile");
      }
    } catch (e) {
      if (!silent) {
        setOiChain(null);
        setOiError(e instanceof Error ? e.message : "Network error");
      }
    }
  }, [oiUnderlying, selected, liveTick?.price]);

  const refreshOiProfile = useCallback(async () => {
    const c = oiChainRef.current;
    if (!c?.tokens?.length) return;
    try {
      const res = await fetch("/api/v1/market/option-chain/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: c.exchange,
          tokens: c.tokens.map(t => t.token),
        }),
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.ok) return;

      setOiChain(prev => {
        if (!prev) return prev;
        const quotes = json.quotes as Record<string, {
          opnInterest?: number; oiChange?: number; oiChangePct?: number;
        }>;
        const patchLeg = (leg?: OptionLeg): OptionLeg | undefined => {
          if (!leg) return leg;
          const q = quotes[leg.token];
          if (!q) return leg;
          const prevOi = oiPrevOiRef.current.get(leg.token);
          const next = { ...leg };
          if (q.opnInterest != null) {
            next.oi = q.opnInterest;
            if (q.oiChange != null) {
              next.oiChange = q.oiChange;
              next.oiChangePct = q.oiChangePct;
            } else if (prevOi != null && prevOi > 0) {
              next.oiChange = q.opnInterest - prevOi;
              next.oiChangePct = (next.oiChange / prevOi) * 100;
            }
            oiPrevOiRef.current.set(leg.token, q.opnInterest);
          }
          return next;
        };
        const rows = prev.rows.map(row => ({
          ...row,
          ce: patchLeg(row.ce),
          pe: patchLeg(row.pe),
        }));
        const updated = { ...prev, rows };
        oiChainRef.current = updated;
        return updated;
      });
      setOiRefreshKey(k => k + 1);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setOiExpiry(undefined);
  }, [selected.token]);

  useEffect(() => {
    if (!oiProfileActive || centerTab !== "chart") {
      setOiChain(null);
      oiChainRef.current = null;
      return;
    }
    loadOiProfile(oiExpiry, !!oiChainRef.current);
  }, [oiProfileActive, centerTab, selected.token, oiUnderlying, oiExpiry, loadOiProfile]);

  useEffect(() => {
    if (!oiProfileActive || centerTab !== "chart") return;
    const id = setInterval(refreshOiProfile, 12_000);
    return () => clearInterval(id);
  }, [oiProfileActive, centerTab, refreshOiProfile]);

  useEffect(() => { fetchCandles(false); }, [selected.token, selected.exchange, selected.tradingSymbol, selected.type, timeframe.fetchInterval, period.days]);

  // ── Intraday silent candle refresh (no loading flash) ─────────────────────
  useEffect(() => {
    const intraday: CandleInterval[] = ["ONE_MINUTE","THREE_MINUTE","FIVE_MINUTE","TEN_MINUTE","FIFTEEN_MINUTE","THIRTY_MINUTE","ONE_HOUR"];
    if (!intraday.includes(timeframe.fetchInterval)) return;
    const refetchMs =
      timeframe.fetchInterval === "ONE_MINUTE"     ? 120_000 :
      timeframe.fetchInterval === "FIVE_MINUTE"    ? 180_000 :
      timeframe.fetchInterval === "FIFTEEN_MINUTE" ? 300_000 : 420_000;
    const id = setInterval(() => fetchCandles(true), refetchMs);
    return () => clearInterval(id);
  }, [timeframe.fetchInterval, fetchCandles]);

  // ── Orders tab ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const { fetchTodayPaperTrades } = await import("@/lib/paper-trade-client");
      const rows = await fetchTodayPaperTrades();
      setOrders(
        rows.map((t) => ({
          symbol: t.symbol,
          side: t.side.toUpperCase(),
          quantity: t.quantity,
          price: t.price,
        })),
      );
    } catch { /* ignore */ }
  }, []);

  const handlePaperOrderPlaced = useCallback(() => {
    fetchOrders();
    setPaperRefreshKey(k => k + 1);
    router.refresh();
  }, [fetchOrders, router]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const normalizeSelection = (item: WatchlistItem): WatchlistItem => ({
    ...item,
    exchange: resolveMarketExchange({
      exchange: item.exchange,
      symboltoken: item.token,
      tradingSymbol: item.tradingSymbol,
      instrumentType: item.type,
    }),
  });

  const openOptionChart = useCallback((item: WatchlistItem) => {
    const normalized = normalizeSelection(item);
    setSelected(normalized);
    setCenterTab("chart");
    setCandleError(null);
  }, []);

  const selectSymbol = useCallback((item: WatchlistItem, tab: CenterTab = "chart") => {
    const normalized = normalizeSelection(item);
    setSelected(normalized);
    setCenterTab(tab);
    setCandleError(null);
  }, []);

  const handleBuy = useCallback((item: WatchlistItem) => {
    selectSymbol(item, "chart");
    setOrderSide("BUY");
    setUtilityPanel("orders");
    setMobilePanel("utility");
  }, [selectSymbol]);

  const handleSell = useCallback((item: WatchlistItem) => {
    selectSymbol(item, "chart");
    setOrderSide("SELL");
    setUtilityPanel("orders");
    setMobilePanel("utility");
  }, [selectSymbol]);

  const resolveWatchlistForPaperSymbol = useCallback(
    (sym: string): WatchlistItem => {
      const upper = sym.toUpperCase();
      const hit = watchlist.find(w => paperSymbolFromWatchlist(w) === upper);
      if (hit) return hit;
      return {
        display: sym,
        tradingSymbol: sym,
        token: "",
        exchange: "NSE",
        type: "EQ",
      };
    },
    [watchlist],
  );

  const handleHoldingsBuy = useCallback(
    (sym: string) => handleBuy(resolveWatchlistForPaperSymbol(sym)),
    [handleBuy, resolveWatchlistForPaperSymbol],
  );

  const handleHoldingsSell = useCallback(
    (sym: string) => handleSell(resolveWatchlistForPaperSymbol(sym)),
    [handleSell, resolveWatchlistForPaperSymbol],
  );

  const baseWatchlist = useMemo(() => {
    const items = allWatchlistItems(storeLists);
    return items.length ? items : DEFAULT_WATCHLIST;
  }, [storeLists, storeVersion]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    setWatchlist(prev => {
      const byKey = new Map(prev.map(p => [`${p.exchange}:${p.token}`, p]));
      return baseWatchlist.map(it => {
        const old = byKey.get(`${it.exchange}:${it.token}`);
        return old
          ? { ...it, ltp: old.ltp, change: old.change, changePct: old.changePct, open: old.open, high: old.high, low: old.low }
          : it;
      });
    });
  }, [baseWatchlist]);

  const mergeQuotesIntoWatchlist = useCallback((items: WatchlistItem[]) => {
    setWatchlist(prev => {
      const byKey = new Map(prev.map(p => [`${p.exchange}:${p.token}`, p]));
      return items.map(it => {
        const old = byKey.get(`${it.exchange}:${it.token}`);
        return old
          ? { ...it, ltp: old.ltp, change: old.change, changePct: old.changePct, open: old.open, high: old.high, low: old.low }
          : it;
      });
    });
  }, []);

  const last = displayCandles[displayCandles.length - 1] ?? candles[candles.length - 1];
  const headerOhlc = liveHeaderOhlc(last, selected.ltp);
  const up   = (selected.changePct ?? 0) >= 0;

  return (
    <div className="trading-terminal">

      {/* ── DRAWING TOOLS ─────────────────────────────────────────────────── */}
      <div className="tt-panel-tools">
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

      {/* ── CHART + RIGHT UTILITY (watchlist via drawer only) ─────────────── */}
      <div className={`tt-panel-main${mobilePanel === "chart" || mobilePanel === "utility" ? " tt-panel-active" : ""}`}>
      <div className="tt-panel-center">

        {/* Symbol header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #eef0f4", padding: "8px 16px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{selected.display}</span>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, background: "#f1f5f9", padding: "1px 6px", borderRadius: 4 }}>{selected.exchange} · {timeframeLabel(timeframe)}</span>
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
          {headerOhlc && (
            <div style={{ display: "flex", gap: 10, marginLeft: "auto", fontSize: 11, color: "#64748b" }}>
              {(["O", "H", "L", "C"] as const).map((l, idx) => (
                <span key={l}><b style={{ color: "#0f172a" }}>{l}</b> {fmtP([headerOhlc.open, headerOhlc.high, headerOhlc.low, headerOhlc.close][idx])}</span>
              ))}
              <span><b style={{ color: "#0f172a" }}>Vol</b> {Number(headerOhlc.volume).toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #eef0f4", padding: "0 16px", display: "flex", alignItems: "center", flexShrink: 0 }}>
          {([
            { id: "chart" as const, label: "Chart" },
            { id: "overview" as const, label: "Overview" },
            { id: "option-chain" as const, label: "Option Chain" },
          ]).map(t => (
            <button key={t.id} type="button" onClick={() => setCenterTab(t.id)}
              style={{ padding: "9px 14px", border: "none", background: "transparent", fontWeight: 700, fontSize: 12, cursor: "pointer",
                color: centerTab === t.id ? "#0ea5e9" : "#64748b",
                borderBottom: centerTab === t.id ? "2px solid #0ea5e9" : "2px solid transparent",
                letterSpacing: 0.3, whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}

          {centerTab === "chart" && (
            <div ref={toolbarRef} className="tv-toolbar" style={{ marginLeft: "auto" }}>
              {/* Timeframe */}
              <div className="tv-toolbar-item">
                <button
                  type="button"
                  className={`tv-toolbar-btn ${showTfMenu ? "open" : ""}`}
                  onClick={() => { setShowTfMenu(v => !v); setShowChartMenu(false); }}
                >
                  {timeframeLabel(timeframe)}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <TimeframeMenu
                  value={timeframe}
                  onChange={changeTimeframe}
                  open={showTfMenu}
                  onClose={() => setShowTfMenu(false)}
                />
              </div>

              {/* Chart type */}
              <div className="tv-toolbar-item">
                <button
                  type="button"
                  className={`tv-toolbar-btn ${showChartMenu ? "open" : ""}`}
                  onClick={() => { setShowChartMenu(v => !v); setShowTfMenu(false); }}
                  title={chartTypeLabel(chartType)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="2" y="4" width="3" height="5"/><line x1="3.5" y1="1" x2="3.5" y2="4"/><rect x="9" y="5" width="3" height="4" fill="currentColor"/></svg>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <ChartTypeMenu
                  value={chartType}
                  onChange={setChartType}
                  open={showChartMenu}
                  onClose={() => setShowChartMenu(false)}
                />
              </div>

              <div className="tv-toolbar-sep" />

              {/* Indicators */}
              <button
                type="button"
                className="tv-toolbar-btn tv-ind-btn"
                onClick={() => setShowIndModal(true)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Indicators
                {activeIndicatorIds.size > 0 && (
                  <span className="tv-badge">{activeIndicatorIds.size}</span>
                )}
              </button>

              {oiProfileActive && oiChain && (
                <>
                  <div className="tv-toolbar-sep" />
                  <div className="tv-toolbar-item oi-prof-toolbar">
                    <span className="oi-prof-toolbar-label">OI</span>
                    <select
                      className="oi-prof-expiry-select"
                      value={oiExpiry ?? oiChain.expiry}
                      onChange={e => setOiExpiry(e.target.value)}
                      aria-label="OI Profile expiry"
                    >
                      {oiChain.expiries.map(ex => (
                        <option key={ex.code} value={ex.code}>{ex.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="tv-toolbar-sep" />

              <button type="button" title="Save chart as PNG" className="tv-toolbar-icon" onClick={() => setScreenshotCount(c => c + 1)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Chart / Overview / Option chain body */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {centerTab === "chart" ? (
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
                    <button type="button" onClick={() => fetchCandles(false)}
                      style={{ marginTop: 4, padding: "7px 16px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#f8fafc", color: "#0f172a" }}>
                      Retry
                    </button>
                  </div>
                ) : (
                  <>
                    <ChartWidget
                      candles={displayCandles}
                      chartType={chartType}
                      activeTool={activeTool}
                      livePrice={liveTick?.price ?? selected.ltp}
                      liveTimestamp={liveTick?.time}
                      liveSeq={liveTick?.seq}
                      screenshotTrigger={screenshotCount}
                      customIndicators={formulaCustomIndicators}
                      chartIndicators={chartIndicators}
                      visibleBars={chartVisibleBars}
                      viewportResetKey={chartViewportKey}
                      oiProfile={
                        oiProfileActive
                          ? {
                              chain: oiChain,
                              symbolLabel: oiUnderlying ?? selected.display,
                              refreshKey: oiRefreshKey + (liveTick?.seq ?? 0),
                            }
                          : undefined
                      }
                    />
                    {oiProfileActive && oiError && !oiChain && (
                      <div className="oi-prof-error">{oiError}</div>
                    )}
                  </>
                )}
              </div>

              {/* Period selector — only show periods within the interval's max-day limit */}
              <div style={{ background: "#fff", borderTop: "1px solid #eef0f4", display: "flex", alignItems: "center", padding: "4px 16px", gap: 2, flexShrink: 0 }}>
                {PERIODS.filter(p => p.days <= maxDaysForTimeframe(timeframe)).map(p => (
                  <button key={p.label} type="button" onClick={() => setPeriod(p)}
                    style={{ padding: "3px 10px", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      background: period.label === p.label ? "rgba(14,165,233,0.12)" : "transparent",
                      color: period.label === p.label ? "#0ea5e9" : "#64748b" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          ) : centerTab === "overview" ? (
            <OverviewPanel symbol={selected} candles={candles} loading={candleLoading} />
          ) : (
            <OptionChainPanel
              symbol={selected}
              spotLtp={selected.ltp}
              spotChangePct={selected.changePct}
              onOpenChart={openOptionChart}
            />
          )}
        </div>
      </div>

      <TradingUtilityShell
        activePanel={utilityPanel}
        onPanelChange={setUtilityPanel}
        selected={selected}
        watchlist={watchlist}
        onWatchlistItemsChange={mergeQuotesIntoWatchlist}
        onSelectSymbol={item => selectSymbol(item, "chart")}
        onOpenChart={openOptionChart}
        onBuy={handleBuy}
        onSell={handleSell}
        orderSide={orderSide}
        orders={orders}
        onRefreshOrders={fetchOrders}
        onOrderPlaced={handlePaperOrderPlaced}
        paperRefreshKey={paperRefreshKey}
        onHoldingsBuy={handleHoldingsBuy}
        onHoldingsSell={handleHoldingsSell}
        onShowOverview={() => setCenterTab("overview")}
        onShowIndicators={() => setShowIndModal(true)}
      />
      </div>

      <nav className="tt-mobile-nav" aria-label="Terminal panels">
        {([
          { label: "Watchlist", panel: "watchlist" as UtilityPanelId },
          { label: "Chart", panel: null },
          { label: "Orders", panel: "orders" as UtilityPanelId },
          { label: "Depth", panel: "depth" as UtilityPanelId },
          { label: "More", panel: "more" as UtilityPanelId },
        ]).map(item => (
          <button
            key={item.label}
            type="button"
            className={
              item.panel === null
                ? mobilePanel === "chart" && !utilityPanel
                  ? "tt-mobile-active"
                  : ""
                : mobilePanel === "utility" && utilityPanel === item.panel
                  ? "tt-mobile-active"
                  : ""
            }
            onClick={() => {
              if (item.panel === null) {
                setMobilePanel("chart");
                setUtilityPanel(null);
              } else {
                setMobilePanel("utility");
                setUtilityPanel(item.panel);
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* ── Custom Indicator Modal ─────────────────────────────────────────── */}
      <IndicatorsModal
        open={showIndModal}
        onClose={() => setShowIndModal(false)}
        activeIds={activeIndicatorIds}
        onToggle={toggleCatalogIndicator}
        onAddCustom={() => setShowAddIndicator(true)}
      />

      {showAddIndicator && (
        <AddIndicatorModal
          candles={displayCandles}
          onAdd={ind => {
            setCustomIndicators(prev => [...prev, ind]);
            setActiveIndicatorIds(prev => new Set(prev).add(ind.id));
            setShowAddIndicator(false);
          }}
          onClose={() => setShowAddIndicator(false)}
        />
      )}
    </div>
  );
}
