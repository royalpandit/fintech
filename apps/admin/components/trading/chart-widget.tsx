"use client";

import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/zerodha";

export type ChartType = "candle" | "bar" | "line";

export interface CustomIndicator {
  id: string;
  name: string;
  /** JS expression using: c (close), o (open), h (high), l (low), v (volume),
   *  SMA(n), EMA(n), STDDEV(n), RSI(n), VWAP()  — evaluated per candle */
  formula: string;
  color: string;
  lineWidth: number; // 1–4
  lineStyle: number; // 0=solid 2=dashed 3=large_dashed 4=sparse_dotted
}

type Props = {
  candles: Candle[];
  showMA20?: boolean;
  showMA50?: boolean;
  chartType?: ChartType;
  activeTool?: string;
  livePrice?: number;
  screenshotTrigger?: number;
  customIndicators?: CustomIndicator[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
type ChartObj  = { remove: AnyFn; applyOptions: AnyFn; addSeries: AnyFn; timeScale: AnyFn; subscribeClick: AnyFn; takeScreenshot?: AnyFn };
type SeriesObj = { setData: AnyFn; update: AnyFn; createPriceLine: AnyFn; removePriceLine: AnyFn; coordinateToPrice: AnyFn };

function builtinSMA(candles: Candle[], period: number) {
  return candles
    .map((_, i) => {
      if (i < period - 1) return null;
      const avg = candles.slice(i - period + 1, i + 1).reduce((s, c) => s + c.close, 0) / period;
      return { time: Math.floor(new Date(candles[i].timestamp).getTime() / 1000), value: avg };
    })
    .filter(Boolean) as { time: number; value: number }[];
}

/**
 * Evaluate a per-candle formula and return a time-series.
 * Exported so the Add Indicator modal can preview / validate formulas.
 */
export function evalCustom(formula: string, candles: Candle[]): { time: number; value: number }[] {
  if (!formula.trim() || candles.length === 0) return [];

  const closes = candles.map(c => c.close);
  const opens  = candles.map(c => c.open);
  const highs  = candles.map(c => c.high);
  const lows   = candles.map(c => c.low);
  const vols   = candles.map(c => c.volume);
  const cache  = new Map<string, number[]>();

  function getSMA(p: number) {
    const k = `sma${p}`;
    if (!cache.has(k)) cache.set(k, closes.map((_, i) =>
      i < p - 1 ? NaN : closes.slice(i - p + 1, i + 1).reduce((s, v) => s + v, 0) / p
    ));
    return cache.get(k)!;
  }

  function getEMA(p: number) {
    const k = `ema${p}`;
    if (!cache.has(k)) {
      const a = new Array<number>(closes.length).fill(NaN);
      if (closes.length >= p) {
        const m = 2 / (p + 1);
        let prev = closes.slice(0, p).reduce((s, v) => s + v, 0) / p;
        a[p - 1] = prev;
        for (let j = p; j < closes.length; j++) { prev = closes[j] * m + prev * (1 - m); a[j] = prev; }
      }
      cache.set(k, a);
    }
    return cache.get(k)!;
  }

  function getSTDDEV(p: number) {
    const k = `std${p}`;
    if (!cache.has(k)) {
      const smaArr = getSMA(p);
      cache.set(k, closes.map((_, i) => {
        if (i < p - 1) return NaN;
        const mean = smaArr[i];
        return Math.sqrt(closes.slice(i - p + 1, i + 1).reduce((acc, v) => acc + (v - mean) ** 2, 0) / p);
      }));
    }
    return cache.get(k)!;
  }

  function getRSI(p: number) {
    const k = `rsi${p}`;
    if (!cache.has(k)) {
      const a = new Array<number>(closes.length).fill(NaN);
      if (closes.length > p) {
        let g = 0, l = 0;
        for (let j = 1; j <= p; j++) { const d = closes[j] - closes[j - 1]; d > 0 ? (g += d) : (l -= d); }
        let ag = g / p, al = l / p;
        a[p] = 100 - 100 / (1 + ag / (al || 1e-10));
        for (let j = p + 1; j < closes.length; j++) {
          const d = closes[j] - closes[j - 1];
          ag = (ag * (p - 1) + Math.max(d, 0)) / p;
          al = (al * (p - 1) + Math.max(-d, 0)) / p;
          a[j] = 100 - 100 / (1 + ag / (al || 1e-10));
        }
      }
      cache.set(k, a);
    }
    return cache.get(k)!;
  }

  function getVWAP() {
    if (!cache.has("vwap")) {
      let pv = 0, vol = 0;
      cache.set("vwap", closes.map((_, i) => {
        const tp = (highs[i] + lows[i] + closes[i]) / 3;
        pv += tp * vols[i]; vol += vols[i];
        return vol > 0 ? pv / vol : NaN;
      }));
    }
    return cache.get("vwap")!;
  }

  // Compile formula once — user-provided client-side only, cannot affect other users
  // eslint-disable-next-line no-new-func
  let fn: ((...a: unknown[]) => number) | null = null;
  try {
    fn = new Function("c","o","h","l","v","SMA","EMA","STDDEV","RSI","VWAP",
      `"use strict";return(${formula});`) as typeof fn;
  } catch { return []; }

  const out: { time: number; value: number }[] = [];
  for (let i = 0; i < candles.length; i++) {
    try {
      const val = fn(
        closes[i], opens[i], highs[i], lows[i], vols[i],
        (p: number) => getSMA(p)[i],
        (p: number) => getEMA(p)[i],
        (p: number) => getSTDDEV(p)[i],
        (p: number) => getRSI(p)[i],
        () => getVWAP()[i],
      );
      if (typeof val === "number" && isFinite(val))
        out.push({ time: Math.floor(new Date(candles[i].timestamp).getTime() / 1000), value: val });
    } catch { /* skip bad candle */ }
  }
  return out;
}

export default function ChartWidget({
  candles,
  showMA20 = true,
  showMA50 = true,
  chartType = "candle",
  activeTool = "cursor",
  livePrice,
  screenshotTrigger = 0,
  customIndicators = [],
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<ChartObj | null>(null);
  const seriesRef     = useRef<SeriesObj | null>(null);
  const priceLinesRef = useRef<unknown[]>([]);
  const activeToolRef = useRef(activeTool);
  const chartTypeRef  = useRef(chartType);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { chartTypeRef.current = chartType;   }, [chartType]);

  // ── Live price: tick-update the last candle ───────────────────────────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || livePrice == null || candles.length === 0) return;
    const last = candles[candles.length - 1];
    const t = Math.floor(new Date(last.timestamp).getTime() / 1000);
    try {
      if (chartTypeRef.current === "line") {
        series.update({ time: t, value: livePrice });
      } else {
        series.update({
          time: t, open: last.open,
          high: Math.max(last.high, livePrice),
          low:  Math.min(last.low,  livePrice),
          close: livePrice,
        });
      }
    } catch { /* series not ready */ }
  }, [livePrice, candles]);

  // ── Eraser: wipe all drawn price lines ───────────────────────────────────
  useEffect(() => {
    if (activeTool !== "eraser") return;
    const series = seriesRef.current;
    if (!series) return;
    priceLinesRef.current.forEach(l => { try { series.removePriceLine(l); } catch { /**/ } });
    priceLinesRef.current = [];
  }, [activeTool]);

  // ── Screenshot ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!screenshotTrigger || !chartRef.current?.takeScreenshot) return;
    try {
      const canvas = chartRef.current.takeScreenshot() as HTMLCanvasElement;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `chart-${Date.now()}.png`;
      a.click();
    } catch { /**/ }
  }, [screenshotTrigger]);

  // ── Main chart build ──────────────────────────────────────────────────────
  useEffect(() => {
    chartRef.current?.remove();
    chartRef.current = null;
    seriesRef.current = null;
    priceLinesRef.current = [];

    const el = containerRef.current;
    if (!el || candles.length === 0) return;

    let observer: ResizeObserver | null = null;

    import("lightweight-charts").then((lc) => {
      if (!containerRef.current) return;
      const el2 = containerRef.current;
      const w = el2.clientWidth  || 800;
      const h = el2.clientHeight || 400;

      const chart = lc.createChart(el2, {
        width: w, height: h,
        layout: {
          background: { type: lc.ColorType.Solid, color: "#ffffff" },
          textColor: "#64748b", fontSize: 11,
          fontFamily: "Inter, system-ui, sans-serif",
        },
        grid:      { vertLines: { color: "#f1f5f9" }, horzLines: { color: "#f1f5f9" } },
        crosshair: { mode: lc.CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#eef0f4" },
        timeScale: { borderColor: "#eef0f4", timeVisible: true, secondsVisible: false, rightOffset: 8 },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
        handleScale: { mouseWheel: true, pinch: true },
      }) as unknown as ChartObj;

      chartRef.current = chart;

      // ── Main series ──────────────────────────────────────────────────────
      let mainSeries: SeriesObj;
      if (chartType === "bar") {
        mainSeries = chart.addSeries(lc.BarSeries, { upColor: "#16a34a", downColor: "#dc2626" }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({
          time: Math.floor(new Date(c.timestamp).getTime() / 1000),
          open: c.open, high: c.high, low: c.low, close: c.close,
        })));
      } else if (chartType === "line") {
        mainSeries = chart.addSeries(lc.LineSeries, { color: "#0ea5e9", lineWidth: 2, priceLineVisible: true }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({
          time: Math.floor(new Date(c.timestamp).getTime() / 1000), value: c.close,
        })));
      } else {
        mainSeries = chart.addSeries(lc.CandlestickSeries, {
          upColor: "#16a34a", downColor: "#dc2626",
          borderUpColor: "#16a34a", borderDownColor: "#dc2626",
          wickUpColor: "#16a34a", wickDownColor: "#dc2626",
          borderVisible: false,
        }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({
          time: Math.floor(new Date(c.timestamp).getTime() / 1000),
          open: c.open, high: c.high, low: c.low, close: c.close,
        })));
      }
      seriesRef.current = mainSeries;

      // ── Volume histogram ─────────────────────────────────────────────────
      const vs = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" }, priceScaleId: "vol",
      }) as unknown as SeriesObj;
      (chart as unknown as { priceScale: (id: string) => { applyOptions: (o: object) => void } })
        .priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 }, visible: false });
      vs.setData(candles.map(c => ({
        time: Math.floor(new Date(c.timestamp).getTime() / 1000),
        value: c.volume,
        color: c.close >= c.open ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)",
      })));

      // ── Built-in MAs ──────────────────────────────────────────────────────
      if (showMA20 && candles.length >= 20) {
        const ma20 = chart.addSeries(lc.LineSeries, {
          color: "#f59e0b", lineWidth: 1.5, priceLineVisible: false,
          lastValueVisible: true, title: "MA20", crosshairMarkerVisible: false,
        }) as unknown as SeriesObj;
        ma20.setData(builtinSMA(candles, 20));
      }
      if (showMA50 && candles.length >= 50) {
        const ma50 = chart.addSeries(lc.LineSeries, {
          color: "#8b5cf6", lineWidth: 1.5, priceLineVisible: false,
          lastValueVisible: true, title: "MA50", crosshairMarkerVisible: false,
        }) as unknown as SeriesObj;
        ma50.setData(builtinSMA(candles, 50));
      }

      // ── Custom indicators ─────────────────────────────────────────────────
      for (const ci of customIndicators) {
        try {
          const data = evalCustom(ci.formula, candles);
          if (data.length === 0) continue;
          const cs = chart.addSeries(lc.LineSeries, {
            color: ci.color,
            lineWidth: Math.min(4, Math.max(1, ci.lineWidth)) as 1,
            lineStyle: ci.lineStyle,
            priceLineVisible: false,
            lastValueVisible: true,
            title: ci.name,
            crosshairMarkerVisible: false,
          }) as unknown as SeriesObj;
          cs.setData(data);
        } catch { /* bad formula — skip silently */ }
      }

      chart.timeScale().fitContent();

      // ── Click handler: H-lines ────────────────────────────────────────────
      chart.subscribeClick((param: { point?: { x: number; y: number }; time?: unknown }) => {
        if (!param.point || !param.time) return;
        if (activeToolRef.current !== "hline") return;
        const series = seriesRef.current;
        if (!series) return;
        try {
          const price = series.coordinateToPrice(param.point.y) as number | null;
          if (price == null) return;
          const line = series.createPriceLine({
            price, color: "#0ea5e9", lineWidth: 1, lineStyle: 2,
            axisLabelVisible: true, title: `₹${price.toFixed(2)}`,
          });
          priceLinesRef.current.push(line);
        } catch { /**/ }
      });

      // ── Resize observer ───────────────────────────────────────────────────
      observer = new ResizeObserver(() => {
        if (!el2 || !chartRef.current) return;
        chartRef.current.applyOptions({ width: el2.clientWidth, height: el2.clientHeight || h });
      });
      observer.observe(el2);
    });

    return () => {
      observer?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [candles, showMA20, showMA50, chartType, customIndicators]);

  // ── Cursor style ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = containerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const map: Record<string, string> = {
      hline: "crosshair", trend: "crosshair", vline: "crosshair",
      pencil: "crosshair", eraser: "cell", text: "text",
    };
    canvas.style.cursor = map[activeTool] ?? "default";
  }, [activeTool]);

  if (candles.length === 0) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 13, background: "#fafafa" }}>
        Loading chart…
      </div>
    );
  }

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
