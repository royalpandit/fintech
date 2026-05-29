import type { Candle } from "@/lib/angelone-types";

/** Where the indicator is drawn on the terminal chart. */
export type IndicatorPane = "overlay" | "volume" | "rsi" | "macd";

export type SeriesPoint = {
  time: number;
  value: number;
  color?: string;
};

export type IndicatorSeriesOutput = {
  key: string;
  title: string;
  pane: IndicatorPane;
  type: "line" | "histogram";
  color: string;
  lineWidth?: number;
  lineStyle?: number;
  data: SeriesPoint[];
};

export type IndicatorComputeResult = {
  series: IndicatorSeriesOutput[];
};

export type IndicatorContext = {
  candles: Candle[];
  times: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
};

export type IndicatorSpec = {
  id: string;
  name: string;
  pane: IndicatorPane;
  category: "POPULAR" | "OTHER";
  favorite?: boolean;
  badge?: string;
  /** Built-in parameter summary for UI */
  paramsLabel?: string;
  compute: (ctx: IndicatorContext) => IndicatorComputeResult;
};

export type ChartIndicatorOutput = {
  overlays: IndicatorSeriesOutput[];
  /** Ordered bottom panes — volume, then rsi, then macd */
  panes: { pane: Exclude<IndicatorPane, "overlay">; series: IndicatorSeriesOutput[] }[];
};
