/** TradingView Advanced Chart widget style: 0 = bars, 1 = candles, 2 = line, 3 = area */
export type TradingViewChartStyle = "0" | "1" | "2" | "3";

/** Common interval presets (TradingView interval codes) */
export type TradingViewInterval =
  | "1"
  | "3"
  | "5"
  | "15"
  | "30"
  | "60"
  | "120"
  | "180"
  | "240"
  | "D"
  | "W"
  | "M";

export type TradingViewTheme = "light" | "dark";

/**
 * Configuration passed to the TradingView Advanced Real-Time Chart embed script.
 * @see https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
 */
export interface TradingViewWidgetConfig {
  autosize: boolean;
  symbol: string;
  interval: TradingViewInterval;
  timezone: string;
  theme: TradingViewTheme;
  style: TradingViewChartStyle;
  locale: string;
  allow_symbol_change: boolean;
  support_host: string;
  withdateranges?: boolean;
  hide_side_toolbar?: boolean;
  hide_top_toolbar?: boolean;
  save_image?: boolean;
  calendar?: boolean;
  backgroundColor?: string;
  gridColor?: string;
  watchlist?: string[];
  studies?: string[];
}

export interface TradingViewChartProps {
  /** TradingView symbol, e.g. `NSE:RELIANCE` */
  symbol?: string;
  /** Chart interval / timeframe */
  interval?: TradingViewInterval;
  /** Chart style; default `1` (candlesticks) */
  style?: TradingViewChartStyle;
  /** `dark` by default */
  theme?: TradingViewTheme;
  /** IANA timezone for the chart */
  timezone?: string;
  /** BCP-47 locale */
  locale?: string;
  /** Allow user symbol search / change */
  allowSymbolChange?: boolean;
  /** Show date range / timeframe controls */
  withDateRanges?: boolean;
  /** Extra CSS class on the outer container */
  className?: string;
  /** Inline height; default `100vh` */
  height?: string;
  /** Called when the embed script has loaded */
  onReady?: () => void;
  /** Called on script load failure */
  onError?: (error: Error) => void;
}
