/**
 * Built-in indicator registry — add new indicators here:
 * 1. Implement `computeX(ctx)` in implementations.ts
 * 2. Register an `IndicatorSpec` below with id, pane, and compute fn
 * 3. Catalog picks it up automatically via chart-config.ts
 */
import type { IndicatorSpec } from "./types";
import {
  computeBollinger,
  computeEma,
  computeMacd,
  computeRsi,
  computeSma,
  computeSupertrend,
  computeVolume,
  computeVwap,
} from "./implementations";

export const INDICATOR_REGISTRY: Record<string, IndicatorSpec> = {
  volume: {
    id: "volume",
    name: "Volume",
    pane: "volume",
    category: "POPULAR",
    favorite: true,
    compute: computeVolume,
  },
  ma20: {
    id: "ma20",
    name: "Moving Average (20)",
    pane: "overlay",
    category: "POPULAR",
    favorite: true,
    paramsLabel: "20",
    compute: ctx => computeSma(ctx, 20, "ma20", "#0ea5e9"),
  },
  ma50: {
    id: "ma50",
    name: "Moving Average (50)",
    pane: "overlay",
    category: "POPULAR",
    paramsLabel: "50",
    compute: ctx => computeSma(ctx, 50, "ma50", "#0284c7"),
  },
  ema20: {
    id: "ema20",
    name: "EMA (20)",
    pane: "overlay",
    category: "POPULAR",
    favorite: true,
    paramsLabel: "20",
    compute: ctx => computeEma(ctx, 20, "ema20", "#f59e0b"),
  },
  ema50: {
    id: "ema50",
    name: "EMA (50)",
    pane: "overlay",
    category: "POPULAR",
    paramsLabel: "50",
    compute: ctx => computeEma(ctx, 50, "ema50", "#a855f7"),
  },
  vwap: {
    id: "vwap",
    name: "VWAP",
    pane: "overlay",
    category: "POPULAR",
    favorite: true,
    compute: computeVwap,
  },
  rsi14: {
    id: "rsi14",
    name: "RSI",
    pane: "rsi",
    category: "POPULAR",
    favorite: true,
    paramsLabel: "14",
    compute: ctx => computeRsi(ctx, 14),
  },
  macd: {
    id: "macd",
    name: "MACD",
    pane: "macd",
    category: "POPULAR",
    favorite: true,
    paramsLabel: "12,26,9",
    compute: ctx => computeMacd(ctx, 12, 26, 9),
  },
  bb: {
    id: "bb",
    name: "Bollinger Bands",
    pane: "overlay",
    category: "POPULAR",
    favorite: true,
    paramsLabel: "20,2",
    compute: ctx => computeBollinger(ctx, 20, 2),
  },
  supertrend: {
    id: "supertrend",
    name: "Supertrend",
    pane: "overlay",
    category: "POPULAR",
    favorite: true,
    paramsLabel: "10,3",
    compute: ctx => computeSupertrend(ctx, 10, 3),
  },
};

export const BUILTIN_INDICATOR_IDS = new Set(Object.keys(INDICATOR_REGISTRY));

export const PANE_ORDER = ["volume", "rsi", "macd"] as const;
