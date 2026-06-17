import type {
  TradingViewChartStyle,
  TradingViewInterval,
  TradingViewTheme,
} from "@/components/tradingview/types";

const WIDGET_EMBED_BASE = "https://www.tradingview.com/widgetembed/";

export interface WidgetEmbedUrlOptions {
  symbol: string;
  interval: TradingViewInterval;
  theme: TradingViewTheme;
  style: TradingViewChartStyle;
  timezone: string;
  locale: string;
  frameElementId: string;
}

/**
 * Builds the official TradingView `widgetembed` iframe URL.
 * Charts load from tradingview.com, which supports NSE/BSE symbol search
 * (the free `embed-widget-advanced-chart.js` script blocks many Indian symbols).
 */
export function buildWidgetEmbedUrl(options: WidgetEmbedUrlOptions): string {
  const params = new URLSearchParams({
    frameElementId: options.frameElementId,
    symbol: options.symbol,
    interval: options.interval,
    hidesidetoolbar: "0",
    hideideas: "1",
    symboledit: "1",
    saveimage: "0",
    toolbarbg: options.theme === "dark" ? "131722" : "f1f3f6",
    studies: "[]",
    theme: options.theme,
    style: options.style,
    timezone: options.timezone,
    withdateranges: "1",
    showpopupbutton: "1",
    locale: options.locale,
    utm_source: "screener",
    utm_medium: "widget",
    utm_campaign: "chart",
  });

  return `${WIDGET_EMBED_BASE}?${params.toString()}`;
}

/** Ensures Indian tickers use the NSE exchange prefix. */
export function normalizeNseSymbol(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return "NSE:RELIANCE";

  if (trimmed.includes(":")) {
    const [exchange, ticker] = trimmed.split(":");
    return `${exchange.toUpperCase()}:${ticker.toUpperCase()}`;
  }

  return `NSE:${trimmed}`;
}
