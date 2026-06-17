import type { TradingViewWidgetConfig } from "./types";

export const TRADINGVIEW_EMBED_SCRIPT_URL =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" as const;

export const TRADINGVIEW_SUPPORT_HOST = "https://www.tradingview.com" as const;

export const DEFAULT_SYMBOL = "NSE:RELIANCE" as const;

export const DEFAULT_TIMEZONE = "Asia/Kolkata" as const;

export const DEFAULT_LOCALE = "en" as const;

export const DEFAULT_INTERVAL = "D" as const;

/** Candlestick chart */
export const DEFAULT_CHART_STYLE = "1" as const;

export const DEFAULT_THEME = "dark" as const;

export const WIDGET_CONTAINER_CLASS = "tradingview-widget-container" as const;

export const WIDGET_INNER_CLASS = "tradingview-widget-container__widget" as const;

export const SCRIPT_LOAD_TIMEOUT_MS = 15_000;

export const DEFAULT_WIDGET_CONFIG: Omit<
  TradingViewWidgetConfig,
  "symbol" | "interval" | "style" | "theme"
> = {
  autosize: true,
  timezone: DEFAULT_TIMEZONE,
  locale: DEFAULT_LOCALE,
  allow_symbol_change: true,
  support_host: TRADINGVIEW_SUPPORT_HOST,
  withdateranges: true,
  hide_side_toolbar: false,
  save_image: false,
  calendar: false,
  backgroundColor: "#131722",
  gridColor: "rgba(242, 242, 242, 0.06)",
};
