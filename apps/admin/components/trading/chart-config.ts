import type { CandleInterval } from "@/lib/angelone";
import { INDICATOR_REGISTRY } from "@/lib/indicators";
import type { IndicatorPane } from "@/lib/indicators";
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

/** Bottom-bar history preset (calendar days fetched from Angel One). */
export interface PeriodPreset {
  label: string;
  days: number;
}

/** Default fetch window per timeframe — avoids loading months of intraday bars. */
export function defaultPeriodForTimeframe(tf: TimeframeOption): PeriodPreset {
  switch (tf.fetchInterval) {
    case "ONE_DAY":
      return { label: "6M", days: 180 };
    case "ONE_MINUTE":
      return { label: "5D", days: 5 };
    case "FIVE_MINUTE":
    case "THREE_MINUTE":
    case "TEN_MINUTE":
      return { label: "10D", days: 10 };
    case "FIFTEEN_MINUTE":
    case "THIRTY_MINUTE":
      return { label: "1M", days: 30 };
    case "ONE_HOUR":
      return { label: "3M", days: 90 };
    default:
      return { label: "1M", days: 30 };
  }
}

/** How many bars to show on load (logical range — weekends collapse, no time gaps). */
export function defaultVisibleBars(tf: TimeframeOption): number {
  const byId: Record<string, number> = {
    "15s": 90, "30s": 90, "45s": 90,
    "1m": 150,
    "2m": 140, "3m": 130, "4m": 130,
    "5m": 180,
    "10m": 140, "15m": 130, "30m": 120,
    "75m": 100, "125m": 80,
    "1h": 130, "2h": 110, "3h": 100, "4h": 90,
    "1D": 120,
  };
  return byId[tf.id] ?? 120;
}

export function isIntradayTimeframe(tf: TimeframeOption): boolean {
  return tf.fetchInterval !== "ONE_DAY";
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

/** @deprecated Use `pane` for built-ins; custom formulas still use kind. */
export type IndicatorKind = "overlay" | "oscillator" | "volume";

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
  /** Built-in engine indicator (OHLCV math, not formula eval). */
  builtin?: boolean;
  pane?: IndicatorPane;
}

const BUILTIN_CATALOG: IndicatorDefinition[] = Object.values(INDICATOR_REGISTRY).map(spec => ({
  id: spec.id,
  name: spec.paramsLabel ? `${spec.name} (${spec.paramsLabel})` : spec.name,
  category: spec.category,
  kind: (spec.pane === "volume"
    ? "volume"
    : spec.pane === "overlay"
      ? "overlay"
      : "oscillator") as IndicatorKind,
  formula: "",
  color: "#64748b",
  favorite: spec.favorite,
  builtin: true,
  pane: spec.pane,
}));

export const INDICATOR_CATALOG: IndicatorDefinition[] = [
  ...BUILTIN_CATALOG,
  { id: "pivot",    name: "Pivot Points Standard",      category: "OTHER", kind: "overlay",    formula: "(h+l+c)/3", color: "#64748b" },
  { id: "ema9",     name: "EMA (9)",                    category: "OTHER", kind: "overlay",    formula: "EMA(9)",  color: "#f97316" },
  { id: "mid",      name: "Midpoint (HL/2)",            category: "OTHER", kind: "overlay",    formula: "(h+l)/2", color: "#94a3b8" },
  { id: "hl-range", name: "HL Range",                   category: "OTHER", kind: "overlay",    formula: "h-l", color: "#ef4444" },
  { id: "mom",      name: "Momentum",                   category: "OTHER", kind: "oscillator", formula: "c-EMA(20)", color: "#0ea5e9" },
  { id: "acc",      name: "Accelerator Oscillator",     category: "OTHER", kind: "oscillator", formula: "c-SMA(5)", color: "#f59e0b" },
  { id: "typical",  name: "Typical Price",              category: "OTHER", kind: "overlay",    formula: "(h+l+c)/3", color: "#64748b" },
  {
    id: "oi-profile",
    name: "OI Profile",
    category: "POPULAR",
    kind: "overlay",
    formula: "",
    color: "#dc2626",
    favorite: true,
    badge: "NEW",
    builtin: true,
    pane: "overlay",
  },
];

export const FAVORITE_TIMEFRAMES_KEY = "tv-fav-timeframes";
export const FAVORITE_CHART_TYPES_KEY = "tv-fav-charttypes";
export const FAVORITE_INDICATORS_KEY = "tv-fav-indicators";
