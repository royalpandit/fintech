"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/client/fetch-api";
import {
  getPollIntervalMs,
  getSecondBucket,
  isSecondInterval,
} from "@/lib/smartapi/intervals";
import type { ChartTimeframe } from "@/lib/smartapi/types";

interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ResolvedSymbol {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
  displayName: string;
}

interface AngelStockChartProps {
  symbolQuery: string;
  timeframe: ChartTimeframe;
  onSymbolResolved?: (symbol: ResolvedSymbol) => void;
}

export function AngelStockChart({
  symbolQuery,
  timeframe,
  onSymbolResolved,
}: AngelStockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ltp, setLtp] = useState<number | null>(null);

  const updateBarFromPrice = useCallback(
    (price: number, bucketSec: number) => {
      const series = seriesRef.current;
      if (!series) return;

      const now = Math.floor(Date.now() / 1000);
      const barTime = (Math.floor(now / bucketSec) * bucketSec) as UTCTimestamp;
      const data = series.data();
      const last = data[data.length - 1];

      if (last && "open" in last && last.time === barTime) {
        series.update({
          time: barTime,
          open: last.open,
          high: Math.max(last.high, price),
          low: Math.min(last.low, price),
          close: price,
        });
      } else {
        series.update({
          time: barTime,
          open: price,
          high: price,
          low: price,
          close: price,
        });
      }
    },
    [],
  );

  const loadCandles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        symbol: symbolQuery,
        interval: timeframe,
      });
      const json = await fetchApi<{
        symbol: ResolvedSymbol;
        candles: ChartCandle[];
      }>(`/api/smartapi/candles?${params}`);

      const symbol = json.symbol;
      onSymbolResolved?.(symbol);

      const secMode = isSecondInterval(timeframe);

      if (secMode) {
        seriesRef.current?.setData([]);
      } else {
        const candles = json.candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        seriesRef.current?.setData(candles);
        chartRef.current?.timeScale().fitContent();
        if (candles.length > 0) {
          setLtp(candles[candles.length - 1].close);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chart load failed");
    } finally {
      setLoading(false);
    }
  }, [symbolQuery, timeframe, onSymbolResolved]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "rgba(242, 242, 242, 0.06)" },
        horzLines: { color: "rgba(242, 242, 242, 0.06)" },
      },
      rightPriceScale: { borderColor: "#2a2e39" },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: isSecondInterval(timeframe),
      },
      crosshair: { mode: 1 },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [timeframe]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  useEffect(() => {
    const pollMs = getPollIntervalMs(timeframe);
    const bucketSec = isSecondInterval(timeframe)
      ? getSecondBucket(timeframe)
      : null;

    const poll = setInterval(async () => {
      try {
        const json = await fetchApi<{ quote: { ltp: number } }>(
          `/api/smartapi/ltp?symbol=${encodeURIComponent(symbolQuery)}`,
        );

        const price = json.quote?.ltp;
        if (!Number.isFinite(price)) return;

        setLtp(price);

        if (bucketSec) {
          updateBarFromPrice(price, bucketSec);
          chartRef.current?.timeScale().scrollToRealTime();
        } else {
          const series = seriesRef.current;
          const data = series?.data();
          if (!series || !data || data.length === 0) return;
          const last = data[data.length - 1];
          if (!("open" in last)) return;

          series.update({
            time: last.time,
            open: last.open,
            high: Math.max(last.high, price),
            low: Math.min(last.low, price),
            close: price,
          });
        }
      } catch {
        /* ignore */
      }
    }, pollMs);

    return () => clearInterval(poll);
  }, [symbolQuery, timeframe, updateBarFromPrice]);

  return (
    <div className="relative h-full w-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#131722]/80">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-[#4a69bd]" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#131722] px-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={loadCandles}
            className="rounded-md bg-[#4a69bd] px-4 py-2 text-sm text-white hover:bg-[#3d58a8]"
          >
            Retry
          </button>
        </div>
      )}

      {ltp !== null && !error && (
        <div className="absolute left-3 top-3 z-10 rounded-md bg-[#1e222d]/90 px-3 py-1.5 text-sm font-medium text-emerald-400 backdrop-blur">
          LTP ₹{ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          {isSecondInterval(timeframe) && (
            <span className="ml-2 text-xs text-zinc-400">
              · {getSecondBucket(timeframe)}s bars
            </span>
          )}
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
