import {
  DEFAULT_CHART_STYLE,
  DEFAULT_INTERVAL,
  DEFAULT_LOCALE,
  DEFAULT_SYMBOL,
  DEFAULT_THEME,
  DEFAULT_TIMEZONE,
  DEFAULT_WIDGET_CONFIG,
  TRADINGVIEW_SUPPORT_HOST,
} from "@/components/tradingview/constants";
import type {
  TradingViewChartProps,
  TradingViewWidgetConfig,
} from "@/components/tradingview/types";

export function buildWidgetConfig(
  props: Pick<
    TradingViewChartProps,
    | "symbol"
    | "interval"
    | "style"
    | "theme"
    | "timezone"
    | "locale"
    | "allowSymbolChange"
    | "withDateRanges"
  >,
): TradingViewWidgetConfig {
  return {
    ...DEFAULT_WIDGET_CONFIG,
    symbol: props.symbol ?? DEFAULT_SYMBOL,
    interval: props.interval ?? DEFAULT_INTERVAL,
    style: props.style ?? DEFAULT_CHART_STYLE,
    theme: props.theme ?? DEFAULT_THEME,
    timezone: props.timezone ?? DEFAULT_TIMEZONE,
    locale: props.locale ?? DEFAULT_LOCALE,
    allow_symbol_change: props.allowSymbolChange ?? true,
    support_host: TRADINGVIEW_SUPPORT_HOST,
    withdateranges: props.withDateRanges ?? true,
  };
}
