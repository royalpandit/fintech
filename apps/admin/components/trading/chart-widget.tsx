"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Candle } from "@/lib/angelone";
import { toHeikinAshi, toRenko } from "./chart-transforms";

export type ChartType =
  | "candle" | "hollow" | "bar" | "line" | "line-markers" | "step"
  | "area" | "baseline" | "columns" | "highlow" | "heikin" | "renko";

export interface CustomIndicator {
  id: string;
  name: string;
  /** JS expression using: c (close), o (open), h (high), l (low), v (volume),
   *  SMA(n), EMA(n), STDDEV(n), RSI(n), VWAP()  — evaluated per candle */
  formula: string;
  color: string;
  lineWidth: number; // 1–4
  lineStyle: number; // 0=solid 2=dashed 3=large_dashed 4=sparse_dotted
  kind?: "overlay" | "oscillator";
}

type Props = {
  candles: Candle[];
  showMA20?: boolean;
  showMA50?: boolean;
  chartType?: ChartType;
  activeTool?: string;
  livePrice?: number;
  /** Unix seconds — floor of the current candle boundary. Drives new-bar creation. */
  liveTimestamp?: number;
  /** Increments every tick — forces the effect to re-fire even when price is unchanged. */
  liveSeq?: number;
  screenshotTrigger?: number;
  customIndicators?: CustomIndicator[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
type ChartObj  = { remove: AnyFn; applyOptions: AnyFn; addSeries: AnyFn; timeScale: AnyFn; subscribeClick: AnyFn; takeScreenshot?: AnyFn };
type SeriesObj = { setData: AnyFn; update: AnyFn; data: AnyFn; createPriceLine: AnyFn; removePriceLine: AnyFn; coordinateToPrice: AnyFn };

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

function prepareCandles(raw: Candle[], chartType: ChartType): Candle[] {
  if (chartType === "heikin") return toHeikinAshi(raw);
  if (chartType === "renko") return toRenko(raw);
  return raw;
}

function candleTime(c: Candle) {
  return Math.floor(new Date(c.timestamp).getTime() / 1000);
}

function chartStructureKey(
  chartType: ChartType,
  showMA20: boolean,
  showMA50: boolean,
  overlayIndicators: CustomIndicator[],
  oscillatorIndicators: CustomIndicator[],
) {
  return `${chartType}|${showMA20}|${showMA50}|${overlayIndicators.map(i => i.id).join()}|${oscillatorIndicators.map(i => i.id).join()}`;
}

function isLineChartType(chartType: ChartType) {
  return ["line", "line-markers", "step", "area", "baseline", "columns"].includes(chartType);
}

function mainSeriesPoints(candles: Candle[], chartType: ChartType) {
  if (isLineChartType(chartType)) {
    return candles.map(c => ({ time: candleTime(c), value: c.close }));
  }
  if (chartType === "highlow") {
    return candles.map(c => ({
      time: candleTime(c), open: c.low, high: c.high, low: c.low, close: c.high,
    }));
  }
  return candles.map(c => ({
    time: candleTime(c), open: c.open, high: c.high, low: c.low, close: c.close,
  }));
}

function volumePoints(candles: Candle[]) {
  return candles.map(c => ({
    time: candleTime(c),
    value: c.volume,
    color: c.close >= c.open ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)",
  }));
}

export default function ChartWidget({
  candles: rawCandles,
  showMA20 = true,
  showMA50 = true,
  chartType = "candle",
  activeTool = "cursor",
  livePrice,
  liveTimestamp,
  liveSeq,
  screenshotTrigger = 0,
  customIndicators = [],
}: Props) {
  const candles = useMemo(() => prepareCandles(rawCandles, chartType), [rawCandles, chartType]);
  const overlayIndicators = useMemo(
    () => customIndicators.filter(ci => ci.kind !== "oscillator"),
    [customIndicators],
  );
  const oscillatorIndicators = useMemo(
    () => customIndicators.filter(ci => ci.kind === "oscillator"),
    [customIndicators],
  );

  const containerRef  = useRef<HTMLDivElement>(null);
  const mainPaneRef   = useRef<HTMLDivElement>(null);
  const oscPaneRef    = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<ChartObj | null>(null);
  const oscChartRef   = useRef<ChartObj | null>(null);
  const seriesRef     = useRef<SeriesObj | null>(null);
  const volumeSeriesRef = useRef<SeriesObj | null>(null);
  const ma20SeriesRef   = useRef<SeriesObj | null>(null);
  const ma50SeriesRef   = useRef<SeriesObj | null>(null);
  const structureKeyRef = useRef("");
  const candlesRef      = useRef(candles);
  const priceLinesRef = useRef<unknown[]>([]);
  const activeToolRef = useRef(activeTool);
  const chartTypeRef  = useRef(chartType);

  candlesRef.current = candles;

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { chartTypeRef.current = chartType;   }, [chartType]);

  // ── Live price tick on the last bar (no full chart rebuild) ───────────────
  useEffect(() => {
    const series = seriesRef.current;
    const cList = candlesRef.current;
    if (!series || livePrice == null || cList.length === 0) return;
    try {
      if (isLineChartType(chartTypeRef.current)) {
        const t = candleTime(cList[cList.length - 1]);
        series.update({ time: t, value: livePrice });
        return;
      }

      const bars = series.data() as { time: number; open: number; high: number; low: number }[];
      const lastBar = bars[bars.length - 1];
      if (!lastBar) return;

      const barT = lastBar.time as number;
      const newBar = liveTimestamp != null && liveTimestamp > barT;

      if (newBar) {
        series.update({ time: liveTimestamp!, open: livePrice, high: livePrice, low: livePrice, close: livePrice });
      } else {
        series.update({
          time:  barT,
          open:  lastBar.open,
          high:  Math.max(lastBar.high, livePrice),
          low:   Math.min(lastBar.low,  livePrice),
          close: livePrice,
        });
      }
    } catch { /* series not ready */ }
  }, [livePrice, liveTimestamp, liveSeq]);

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

  // ── Main chart build / silent data refresh ─────────────────────────────────
  useEffect(() => {
    const mainEl = mainPaneRef.current;
    if (!mainEl || candles.length === 0) return;

    const key = chartStructureKey(chartType, showMA20, showMA50, overlayIndicators, oscillatorIndicators);
    const dataOnly = key === structureKeyRef.current && chartRef.current && seriesRef.current;

    if (dataOnly) {
      seriesRef.current!.setData(mainSeriesPoints(candles, chartType));
      volumeSeriesRef.current?.setData(volumePoints(candles));
      if (ma20SeriesRef.current && candles.length >= 20) ma20SeriesRef.current.setData(builtinSMA(candles, 20));
      if (ma50SeriesRef.current && candles.length >= 50) ma50SeriesRef.current.setData(builtinSMA(candles, 50));
      return;
    }

    structureKeyRef.current = key;
    chartRef.current?.remove();
    oscChartRef.current?.remove();
    chartRef.current = null;
    oscChartRef.current = null;
    seriesRef.current = null;
    volumeSeriesRef.current = null;
    ma20SeriesRef.current = null;
    ma50SeriesRef.current = null;
    priceLinesRef.current = [];

    let observer: ResizeObserver | null = null;
    const hasOsc = oscillatorIndicators.length > 0;

    import("lightweight-charts").then((lc) => {
      if (!mainPaneRef.current) return;
      const el2 = mainPaneRef.current;
      const w = el2.clientWidth  || 800;
      const totalH = containerRef.current?.clientHeight || 400;
      const oscH = hasOsc ? Math.min(140, Math.floor(totalH * 0.28)) : 0;
      const mainH = Math.max(200, totalH - oscH);

      const chartOpts = {
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
      };

      const chart = lc.createChart(el2, { width: w, height: mainH, ...chartOpts }) as unknown as ChartObj;
      chartRef.current = chart;

      const ohlcTypes: ChartType[] = ["candle", "hollow", "heikin"];
      const lineTypes: ChartType[] = ["line", "line-markers", "step"];

      // ── Main series ──────────────────────────────────────────────────────
      let mainSeries: SeriesObj;
      if (chartType === "bar" || chartType === "renko") {
        mainSeries = chart.addSeries(lc.BarSeries, { upColor: "#16a34a", downColor: "#dc2626" }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({
          time: candleTime(c), open: c.open, high: c.high, low: c.low, close: c.close,
        })));
      } else if (lineTypes.includes(chartType)) {
        mainSeries = chart.addSeries(lc.LineSeries, {
          color: "#0ea5e9", lineWidth: 2, priceLineVisible: true,
          ...(chartType === "line-markers" ? { pointMarkersVisible: true } : {}),
          ...(chartType === "step" ? { lineType: 1 } : {}),
        }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({ time: candleTime(c), value: c.close })));
      } else if (chartType === "area") {
        mainSeries = chart.addSeries(lc.AreaSeries, {
          lineColor: "#0ea5e9", topColor: "rgba(14,165,233,0.35)", bottomColor: "rgba(14,165,233,0.02)",
          lineWidth: 2,
        }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({ time: candleTime(c), value: c.close })));
      } else if (chartType === "baseline") {
        const base = candles.reduce((s, c) => s + c.close, 0) / candles.length;
        mainSeries = chart.addSeries(lc.BaselineSeries, {
          baseValue: { type: "price", price: base },
          topLineColor: "#16a34a", bottomLineColor: "#dc2626",
          topFillColor1: "rgba(22,163,74,0.2)", topFillColor2: "rgba(22,163,74,0.05)",
          bottomFillColor1: "rgba(220,38,38,0.05)", bottomFillColor2: "rgba(220,38,38,0.2)",
        }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({ time: candleTime(c), value: c.close })));
      } else if (chartType === "columns") {
        mainSeries = chart.addSeries(lc.HistogramSeries, {
          priceFormat: { type: "price" }, priceScaleId: "right",
        }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({
          time: candleTime(c), value: c.close,
          color: c.close >= c.open ? "#16a34a" : "#dc2626",
        })));
      } else if (chartType === "highlow") {
        mainSeries = chart.addSeries(lc.BarSeries, {
          thinBars: true, upColor: "#16a34a", downColor: "#dc2626",
        }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({
          time: candleTime(c), open: c.low, high: c.high, low: c.low, close: c.high,
        })));
      } else if (ohlcTypes.includes(chartType)) {
        const hollow = chartType === "hollow";
        mainSeries = chart.addSeries(lc.CandlestickSeries, {
          upColor: hollow ? "#ffffff" : "#16a34a",
          downColor: "#dc2626",
          borderUpColor: "#16a34a", borderDownColor: "#dc2626",
          wickUpColor: "#16a34a", wickDownColor: "#dc2626",
          borderVisible: true,
        }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({
          time: candleTime(c), open: c.open, high: c.high, low: c.low, close: c.close,
        })));
      } else {
        mainSeries = chart.addSeries(lc.CandlestickSeries, {
          upColor: "#16a34a", downColor: "#dc2626",
          borderUpColor: "#16a34a", borderDownColor: "#dc2626",
          wickUpColor: "#16a34a", wickDownColor: "#dc2626",
          borderVisible: false,
        }) as unknown as SeriesObj;
        mainSeries.setData(candles.map(c => ({
          time: candleTime(c), open: c.open, high: c.high, low: c.low, close: c.close,
        })));
      }
      seriesRef.current = mainSeries;

      // ── Volume histogram ─────────────────────────────────────────────────
      const vs = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" }, priceScaleId: "vol",
      }) as unknown as SeriesObj;
      volumeSeriesRef.current = vs;
      (chart as unknown as { priceScale: (id: string) => { applyOptions: (o: object) => void } })
        .priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 }, visible: false });
      vs.setData(volumePoints(candles));

      // ── Built-in MAs ──────────────────────────────────────────────────────
      if (showMA20 && candles.length >= 20) {
        const ma20 = chart.addSeries(lc.LineSeries, {
          color: "#f59e0b", lineWidth: 1.5, priceLineVisible: false,
          lastValueVisible: true, title: "MA20", crosshairMarkerVisible: false,
        }) as unknown as SeriesObj;
        ma20SeriesRef.current = ma20;
        ma20.setData(builtinSMA(candles, 20));
      }
      if (showMA50 && candles.length >= 50) {
        const ma50 = chart.addSeries(lc.LineSeries, {
          color: "#8b5cf6", lineWidth: 1.5, priceLineVisible: false,
          lastValueVisible: true, title: "MA50", crosshairMarkerVisible: false,
        }) as unknown as SeriesObj;
        ma50SeriesRef.current = ma50;
        ma50.setData(builtinSMA(candles, 50));
      }

      // ── Overlay custom indicators ─────────────────────────────────────────
      for (const ci of overlayIndicators) {
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
        } catch { /* skip */ }
      }

      // ── Oscillator pane ───────────────────────────────────────────────────
      if (hasOsc && oscPaneRef.current) {
        const oscChart = lc.createChart(oscPaneRef.current, {
          width: w, height: oscH, ...chartOpts,
          timeScale: { ...chartOpts.timeScale, visible: false },
        }) as unknown as ChartObj;
        oscChartRef.current = oscChart;
        for (const ci of oscillatorIndicators) {
          try {
            const data = evalCustom(ci.formula, candles);
            if (data.length === 0) continue;
            const cs = oscChart.addSeries(lc.LineSeries, {
              color: ci.color,
              lineWidth: Math.min(4, Math.max(1, ci.lineWidth)) as 1,
              title: ci.name,
              priceLineVisible: false,
              lastValueVisible: true,
            }) as unknown as SeriesObj;
            cs.setData(data);
          } catch { /* skip */ }
        }
        oscChart.timeScale().fitContent();
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
        if (!el2 || !chartRef.current || !containerRef.current) return;
        const tw = el2.clientWidth;
        const totalH = containerRef.current.clientHeight || mainH;
        const oH = hasOsc ? Math.min(140, Math.floor(totalH * 0.28)) : 0;
        const mH = Math.max(200, totalH - oH);
        chartRef.current.applyOptions({ width: tw, height: mH });
        oscChartRef.current?.applyOptions({ width: tw, height: oH });
      });
      observer.observe(containerRef.current ?? el2);
    });

    return () => {
      observer?.disconnect();
      chartRef.current?.remove();
      oscChartRef.current?.remove();
      chartRef.current = null;
      oscChartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      ma20SeriesRef.current = null;
      ma50SeriesRef.current = null;
      structureKeyRef.current = "";
    };
  }, [candles, showMA20, showMA50, chartType, overlayIndicators, oscillatorIndicators]);

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

  if (rawCandles.length === 0) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 13, background: "#fafafa" }}>
        Loading chart…
      </div>
    );
  }

  const hasOsc = oscillatorIndicators.length > 0;

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div ref={mainPaneRef} style={{ flex: hasOsc ? "1 1 auto" : "1 1 100%", minHeight: 0 }} />
      {hasOsc && (
        <div
          ref={oscPaneRef}
          style={{
            flex: "0 0 auto",
            height: 120,
            borderTop: "1px solid #eef0f4",
            background: "#fafafa",
          }}
        />
      )}
    </div>
  );
}
