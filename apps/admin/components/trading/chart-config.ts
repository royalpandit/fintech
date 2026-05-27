import type { CandleInterval } from "@/lib/angelone";
import type { ChartType } from "./chart-widget";

/** UI timeframe → Angel One fetch interval + optional client aggregation */
export interface TimeframeOption {
  id: string;
  label: string;
  section: "SECONDS" | "MINUTES" | "HOURS";
  fetchInterval: CandleInterval;
  /** Combine N consecutive candles after fetch (e.g. 2m from 1m) */
  aggregate?: number;
  /** Shown when API cannot provide native interval */
  hint?: string;
  favorite?: boolean;
}

export const TIMEFRAME_GROUPS: { section: TimeframeOption["section"]; items: TimeframeOption[] }[] = [
  {
    section: "SECONDS",
    items: [
      { id: "15s", label: "15 seconds", section: "SECONDS", fetchInterval: "ONE_MINUTE", hint: "Uses 1m candles" },
      { id: "30s", label: "30 seconds", section: "SECONDS", fetchInterval: "ONE_MINUTE", hint: "Uses 1m candles" },
      { id: "45s", label: "45 seconds", section: "SECONDS", fetchInterval: "ONE_MINUTE", hint: "Uses 1m candles" },
    ],
  },
  {
    section: "MINUTES",
    items: [
      { id: "1m",  label: "1 minute",   section: "MINUTES", fetchInterval: "ONE_MINUTE",     favorite: true },
      { id: "2m",  label: "2 minutes",  section: "MINUTES", fetchInterval: "ONE_MINUTE",     aggregate: 2 },
      { id: "3m",  label: "3 minutes",  section: "MINUTES", fetchInterval: "THREE_MINUTE" },
      { id: "4m",  label: "4 minutes",  section: "MINUTES", fetchInterval: "ONE_MINUTE",     aggregate: 4 },
      { id: "5m",  label: "5 minutes",  section: "MINUTES", fetchInterval: "FIVE_MINUTE",    favorite: true },
      { id: "10m", label: "10 minutes", section: "MINUTES", fetchInterval: "TEN_MINUTE" },
      { id: "15m", label: "15 minutes", section: "MINUTES", fetchInterval: "FIFTEEN_MINUTE" },
      { id: "30m", label: "30 minutes", section: "MINUTES", fetchInterval: "THIRTY_MINUTE" },
      { id: "75m", label: "75 minutes", section: "MINUTES", fetchInterval: "FIFTEEN_MINUTE", aggregate: 5 },
      { id: "125m",label: "125 minutes",section: "MINUTES", fetchInterval: "FIVE_MINUTE",    aggregate: 25 },
    ],
  },
  {
    section: "HOURS",
    items: [
      { id: "1h", label: "1 hour",  section: "HOURS", fetchInterval: "ONE_HOUR" },
      { id: "2h", label: "2 hours", section: "HOURS", fetchInterval: "ONE_HOUR", aggregate: 2 },
      { id: "3h", label: "3 hours", section: "HOURS", fetchInterval: "ONE_HOUR", aggregate: 3 },
      { id: "4h", label: "4 hours", section: "HOURS", fetchInterval: "ONE_HOUR", aggregate: 4 },
      { id: "1D", label: "1 day",   section: "HOURS", fetchInterval: "ONE_DAY" },
    ],
  },
];

export const ALL_TIMEFRAMES = TIMEFRAME_GROUPS.flatMap(g => g.items);

export const DEFAULT_TIMEFRAME = ALL_TIMEFRAMES.find(t => t.id === "5m")!;

export const INTERVAL_MAX_DAYS: Partial<Record<CandleInterval, number>> = {
  ONE_MINUTE:     30,
  THREE_MINUTE:   60,
  FIVE_MINUTE:    100,
  TEN_MINUTE:     100,
  FIFTEEN_MINUTE: 200,
  THIRTY_MINUTE:  200,
  ONE_HOUR:       400,
  ONE_DAY:        2000,
};

export function maxDaysForTimeframe(tf: TimeframeOption): number {
  const base = INTERVAL_MAX_DAYS[tf.fetchInterval] ?? 60;
  if (tf.aggregate && tf.aggregate > 1) return Math.min(base * tf.aggregate, 2000);
  return base;
}

export interface ChartTypeOption {
  id: ChartType;
  label: string;
  section: "BARS" | "LINES" | "AREAS" | "COLUMNS" | "ADVANCED";
  favorite?: boolean;
}

export const CHART_TYPE_GROUPS: { section: ChartTypeOption["section"]; items: ChartTypeOption[] }[] = [
  {
    section: "BARS",
    items: [
      { id: "bar",    label: "Bars",           section: "BARS", favorite: true },
      { id: "candle", label: "Candles",        section: "BARS", favorite: true },
      { id: "hollow", label: "Hollow candles", section: "BARS" },
    ],
  },
  {
    section: "LINES",
    items: [
      { id: "line",         label: "Line",              section: "LINES" },
      { id: "line-markers", label: "Line with markers", section: "LINES" },
      { id: "step",         label: "Step line",         section: "LINES" },
    ],
  },
  {
    section: "AREAS",
    items: [
      { id: "area",     label: "Area",     section: "AREAS" },
      { id: "baseline", label: "Baseline", section: "AREAS" },
    ],
  },
  {
    section: "COLUMNS",
    items: [
      { id: "columns",  label: "Columns",  section: "COLUMNS" },
      { id: "highlow",  label: "High-low", section: "COLUMNS" },
    ],
  },
  {
    section: "ADVANCED",
    items: [
      { id: "heikin", label: "Heikin Ashi", section: "ADVANCED" },
      { id: "renko",  label: "Renko",       section: "ADVANCED" },
    ],
  },
];

export const ALL_CHART_TYPES = CHART_TYPE_GROUPS.flatMap(g => g.items);

export type IndicatorKind = "overlay" | "oscillator";

export interface IndicatorDefinition {
  id: string;
  name: string;
  category: "POPULAR" | "OTHER";
  kind: IndicatorKind;
  formula: string;
  color: string;
  lineWidth?: number;
  favorite?: boolean;
  badge?: string;
}

export const INDICATOR_CATALOG: IndicatorDefinition[] = [
  { id: "ema20",    name: "Moving Average Exponential", category: "POPULAR", kind: "overlay",    formula: "EMA(20)", color: "#f59e0b", favorite: true },
  { id: "sma20",    name: "Moving Average",             category: "POPULAR", kind: "overlay",    formula: "SMA(20)", color: "#0ea5e9" },
  { id: "vwap",     name: "VWAP",                       category: "POPULAR", kind: "overlay",    formula: "VWAP()",  color: "#8b5cf6", favorite: true },
  { id: "bb",       name: "Bollinger Bands",            category: "POPULAR", kind: "overlay",    formula: "SMA(20)", color: "#6366f1" },
  { id: "bb-up",    name: "Bollinger Bands Upper",      category: "POPULAR", kind: "overlay",    formula: "SMA(20)+STDDEV(20)*2", color: "#6366f1", lineWidth: 1 },
  { id: "bb-low",   name: "Bollinger Bands Lower",      category: "POPULAR", kind: "overlay",    formula: "SMA(20)-STDDEV(20)*2", color: "#6366f1", lineWidth: 1 },
  { id: "rsi14",    name: "Relative Strength Index",    category: "POPULAR", kind: "oscillator", formula: "RSI(14)", color: "#ec4899", favorite: true },
  { id: "macd",     name: "MACD",                       category: "POPULAR", kind: "oscillator", formula: "EMA(12)-EMA(26)", color: "#14b8a6" },
  { id: "st",       name: "SuperTrend (approx)",        category: "POPULAR", kind: "overlay",    formula: "(h+l)/2", color: "#22c55e", favorite: true },
  { id: "pivot",    name: "Pivot Points Standard",      category: "POPULAR", kind: "overlay",    formula: "(h+l+c)/3", color: "#64748b" },
  { id: "ema9",     name: "EMA (9)",                    category: "OTHER",   kind: "overlay",    formula: "EMA(9)",  color: "#f97316" },
  { id: "ema50",    name: "EMA (50)",                   category: "OTHER",   kind: "overlay",    formula: "EMA(50)", color: "#a855f7" },
  { id: "sma50",    name: "SMA (50)",                   category: "OTHER",   kind: "overlay",    formula: "SMA(50)", color: "#8b5cf6" },
  { id: "mid",      name: "Midpoint (HL/2)",            category: "OTHER",   kind: "overlay",    formula: "(h+l)/2", color: "#94a3b8" },
  { id: "hl-range", name: "HL Range",                   category: "OTHER",   kind: "overlay",    formula: "h-l", color: "#ef4444" },
  { id: "mom",      name: "Momentum",                   category: "OTHER",   kind: "oscillator", formula: "c-EMA(20)", color: "#0ea5e9" },
  { id: "acc",      name: "Accelerator Oscillator",     category: "OTHER",   kind: "oscillator", formula: "c-SMA(5)", color: "#f59e0b" },
  { id: "typical",  name: "Typical Price",              category: "OTHER",   kind: "overlay",    formula: "(h+l+c)/3", color: "#64748b" },
  { id: "oi-prof",  name: "Open Interest Profile",      category: "OTHER",   kind: "overlay",    formula: "v", color: "#dc2626", badge: "NEW" },
];

export const FAVORITE_TIMEFRAMES_KEY = "tv-fav-timeframes";
export const FAVORITE_CHART_TYPES_KEY = "tv-fav-charttypes";
export const FAVORITE_INDICATORS_KEY = "tv-fav-indicators";
