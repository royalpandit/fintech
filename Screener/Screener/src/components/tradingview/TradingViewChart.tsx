"use client";

import { useId, useMemo, useState } from "react";
import { buildWidgetConfig } from "@/lib/tradingview/build-widget-config";
import { buildWidgetEmbedUrl } from "@/lib/tradingview/build-widget-embed-url";
import { TradingViewChartLoading } from "./TradingViewChartLoading";
import type { TradingViewChartProps } from "./types";

/**
 * NSE/BSE charts use the TradingView `widgetembed` iframe because the free
 * `embed-widget-advanced-chart.js` script blocks many Indian symbols on third-party sites.
 */
export function TradingViewChart({
  symbol,
  interval,
  style,
  theme,
  timezone,
  locale,
  allowSymbolChange,
  withDateRanges,
  className = "",
  height = "100vh",
  onReady,
  onError,
}: TradingViewChartProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const frameId = useId().replace(/:/g, "");

  const widgetConfig = useMemo(
    () =>
      buildWidgetConfig({
        symbol,
        interval,
        style,
        theme,
        timezone,
        locale,
        allowSymbolChange,
        withDateRanges,
      }),
    [
      symbol,
      interval,
      style,
      theme,
      timezone,
      locale,
      allowSymbolChange,
      withDateRanges,
    ],
  );

  const iframeSrc = useMemo(
    () =>
      buildWidgetEmbedUrl({
        symbol: widgetConfig.symbol,
        interval: widgetConfig.interval,
        theme: widgetConfig.theme,
        style: widgetConfig.style,
        timezone: widgetConfig.timezone,
        locale: widgetConfig.locale,
        frameElementId: `tradingview_${frameId}`,
      }),
    [widgetConfig, frameId],
  );

  return (
    <section
      className={`relative w-full overflow-hidden bg-[#131722] ${className}`}
      style={{ height }}
      aria-label={`Live stock chart: ${widgetConfig.symbol}`}
    >
      {isLoading && !hasError && <TradingViewChartLoading />}

      {hasError && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#131722] px-6 text-center"
          role="alert"
        >
          <p className="text-sm font-medium text-red-400">
            Unable to load the chart. Check your connection and try again.
          </p>
        </div>
      )}

      <iframe
        key={iframeSrc}
        title={`TradingView chart for ${widgetConfig.symbol}`}
        src={iframeSrc}
        className="h-full w-full border-0"
        style={{ height: "100%", width: "100%" }}
        allow="fullscreen"
        scrolling="no"
        onLoad={() => {
          setIsLoading(false);
          setHasError(false);
          onReady?.();
        }}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
          onError?.(new Error("TradingView iframe failed to load"));
        }}
      />
    </section>
  );
}
