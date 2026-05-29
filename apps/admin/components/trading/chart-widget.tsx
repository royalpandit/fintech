"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import type { Candle } from "@/lib/angelone";
import {
  nseChartLocalization,
  nseChartTickMarkFormatter,
  parseCandleTimestampToUnix,
} from "@/lib/nse-market-time";
import type { ChartIndicatorOutput, IndicatorSeriesOutput } from "@/lib/indicators";
import { lastPointsPerSeries } from "@/lib/indicators";
import OiProfileOverlay from "./oi-profile-overlay";
import type { OptionChainData } from "./option-chain-panel";
import { toHeikinAshi, toRenko } from "./chart-transforms";

export const OI_PROFILE_INDICATOR_ID = "oi-profile";

type LowerPaneId = "volume" | "rsi" | "macd";

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
  kind?: "overlay" | "oscillator" | "volume";
}

/** Angel One / TradingView-style soft volume bars */
const VOL_COLOR_UP = "rgba(38, 166, 154, 0.55)";
const VOL_COLOR_DOWN = "rgba(239, 83, 80, 0.55)";
type Props = {
  candles: Candle[];
  chartType?: ChartType;
  activeTool?: string;
  livePrice?: number;
  /** Unix seconds — floor of the current candle boundary. Drives new-bar creation. */
  liveTimestamp?: number;
  /** Increments every tick — forces the effect to re-fire even when price is unchanged. */
  liveSeq?: number;
  screenshotTrigger?: number;
  customIndicators?: CustomIndicator[];
  /** Built-in indicators from OHLCV engine (MA, RSI, MACD, …). */
  chartIndicators?: ChartIndicatorOutput;
  /** Bars visible on load / after symbol·timeframe·period change (logical indices). */
  visibleBars?: number;
  /** Change to re-anchor viewport to the latest candles. */
  viewportResetKey?: string;
  /** OI Profile overlay (option chain → price axis). */
  oiProfile?: {
    chain: OptionChainData | null;
    symbolLabel: string;
    refreshKey?: number;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
type ChartObj  = { remove: AnyFn; applyOptions: AnyFn; addSeries: AnyFn; timeScale: AnyFn; subscribeClick: AnyFn; takeScreenshot?: AnyFn };
type SeriesObj = {
  setData: AnyFn;
  update: AnyFn;
  data: AnyFn;
  createPriceLine: AnyFn;
  removePriceLine: AnyFn;
  coordinateToPrice: AnyFn;
  priceScale?: () => { applyOptions: (o: object) => void };
};

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
        out.push({ time: parseCandleTimestampToUnix(candles[i].timestamp), value: val });
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
  return parseCandleTimestampToUnix(c.timestamp);
}

function chartStructureKey(
  chartType: ChartType,
  indicatorKey: string,
  overlayIndicators: CustomIndicator[],
  customOscIndicators: CustomIndicator[],
) {
  return `${chartType}|${indicatorKey}|${overlayIndicators.map(i => i.id).join()}|${customOscIndicators.map(i => i.id).join()}`;
}

function indicatorLayoutKey(output: ChartIndicatorOutput | undefined): string {
  if (!output) return "";
  const panes = output.panes.map(p => p.pane).join(",");
  const overlays = output.overlays.map(o => o.key).join(",");
  return `${panes}|${overlays}`;
}

function computeChartLayout(totalH: number, paneCount: number) {
  if (paneCount <= 0) return { mainH: Math.max(200, totalH), paneH: 0 };
  const paneH = Math.min(120, Math.max(72, Math.floor(totalH * 0.15)));
  const mainH = Math.max(160, totalH - paneH * paneCount);
  return { mainH, paneH };
}

function isVolumeIndicator(ci: CustomIndicator) {
  return ci.kind === "volume" || ci.id === "volume";
}

/** Keep main + lower panes scrolled/zoomed together */
/** Angel One / TradingView-style: recent bars, readable spacing, no fit-all compression. */
function applyRecentViewport(chart: ChartObj, barCount: number, visibleBars: number) {
  if (barCount <= 0) return;
  const ts = chart.timeScale();
  try {
    ts.applyOptions({
      barSpacing: 8,
      minBarSpacing: 3,
      rightOffset: 12,
      fixLeftEdge: false,
      fixRightEdge: false,
    });
    const vis = Math.min(Math.max(visibleBars, 40), barCount);
    const from = Math.max(0, barCount - vis);
    ts.setVisibleLogicalRange({ from, to: barCount + 4 });
    if (typeof ts.scrollToRealTime === "function") ts.scrollToRealTime();
  } catch {
    try {
      ts.fitContent();
    } catch {
      /* chart tearing down */
    }
  }
}

function bindTimeScales(leader: ChartObj, followers: ChartObj[]) {
  if (followers.length === 0) return;
  let syncing = false;
  const apply = (range: unknown) => {
    if (!range || syncing) return;
    syncing = true;
    for (const chart of followers) {
      try {
        chart.timeScale().setVisibleLogicalRange(range);
      } catch {
        /* pane not ready */
      }
    }
    syncing = false;
  };
  try {
    leader.timeScale().subscribeVisibleLogicalRangeChange(apply);
    const initial = leader.timeScale().getVisibleLogicalRange?.();
    if (initial) apply(initial);
  } catch {
    /* older API */
  }
}

function mountIndicatorSeries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lc: any,
  chart: ChartObj,
  spec: IndicatorSeriesOutput,
  pane: "main" | LowerPaneId,
): SeriesObj {
  if (spec.type === "histogram") {
    const hs = chart.addSeries(lc.HistogramSeries, {
      color: spec.color,
      title: spec.title,
      priceFormat: pane === "volume" ? { type: "volume" } : { type: "price" },
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    }) as unknown as SeriesObj;
    hs.setData(spec.data);
    return hs;
  }
  const ls = chart.addSeries(lc.LineSeries, {
    color: spec.color,
    lineWidth: Math.min(4, Math.max(1, spec.lineWidth ?? 2)) as 1,
    lineStyle: spec.lineStyle ?? 0,
    title: spec.title,
    priceLineVisible: false,
    lastValueVisible: true,
    crosshairMarkerVisible: false,
  }) as unknown as SeriesObj;
  ls.setData(spec.data);
  return ls;
}

function patchIndicatorSeries(
  seriesMap: Map<string, SeriesObj>,
  output: ChartIndicatorOutput | undefined,
) {
  if (!output) return;
  const points = lastPointsPerSeries(output);
  points.forEach((pt, key) => {
    const s = seriesMap.get(key);
    if (!s) return;
    try {
      s.update(pt);
    } catch { /* skip */ }
  });
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

/** Push latest candle OHLC into LWC without replacing the full series (avoids lag vs header). */
function patchActiveBarOnSeries(
  series: SeriesObj,
  volSeries: SeriesObj | null,
  priceCandles: Candle[],
  volumeSource: Candle[],
  chartType: ChartType,
) {
  if (priceCandles.length === 0) return;
  const c = priceCandles[priceCandles.length - 1];
  const t = candleTime(c);

  if (isLineChartType(chartType)) {
    series.update({ time: t, value: c.close });
    return;
  }

  const point =
    chartType === "highlow"
      ? { time: t, open: c.low, high: c.high, low: c.low, close: c.high }
      : { time: t, open: c.open, high: c.high, low: c.low, close: c.close };

  series.update(point);

  if (volSeries) {
    const volPts = volumePoints(priceCandles, volumeSource);
    const v = volPts[volPts.length - 1];
    if (v) volSeries.update(v);
  }
}

function volumePoints(priceCandles: Candle[], volumeSource: Candle[]) {
  const volByTime = new Map(
    volumeSource.map(c => [candleTime(c), Math.max(0, Number(c.volume) || 0)]),
  );
  const raw = priceCandles.map(c => {
    const t = candleTime(c);
    return volByTime.get(t) ?? Math.max(0, Number(c.volume) || 0);
  });
  const maxVol = Math.max(0, ...raw);
  const maxRange = Math.max(1e-6, ...priceCandles.map(c => Math.max(0, c.high - c.low)));

  return priceCandles.map((c, i) => {
    const t = candleTime(c);
    let value = raw[i];
    // Index spot often has volume=0 from Angel API — use range-relative height until futures vol merges
    if (maxVol <= 0) {
      value = Math.max(1, Math.round(((c.high - c.low) / maxRange) * 1000));
    }
    return {
      time: t,
      value,
      color: c.close >= c.open ? VOL_COLOR_UP : VOL_COLOR_DOWN,
    };
  });
}

export default function ChartWidget({
  candles: rawCandles,
  chartType = "candle",
  activeTool = "cursor",
  livePrice,
  liveTimestamp,
  liveSeq,
  screenshotTrigger = 0,
  customIndicators = [],
  chartIndicators,
  visibleBars = 120,
  viewportResetKey = "",
  oiProfile,
}: Props) {
  const candles = useMemo(() => prepareCandles(rawCandles, chartType), [rawCandles, chartType]);
  const customOverlayIndicators = useMemo(
    () => customIndicators.filter(ci => !isVolumeIndicator(ci) && ci.kind !== "oscillator"),
    [customIndicators],
  );
  const customOscIndicators = useMemo(
    () => customIndicators.filter(ci => ci.kind === "oscillator"),
    [customIndicators],
  );
  const lowerPaneIds = useMemo((): LowerPaneId[] => {
    const ids = chartIndicators?.panes.map(p => p.pane) ?? [];
    return ids.filter((p): p is LowerPaneId => p === "volume" || p === "rsi" || p === "macd");
  }, [chartIndicators]);
  const hasCustomOsc = customOscIndicators.length > 0;
  const hasLowerPanes = lowerPaneIds.length > 0 || hasCustomOsc;

  const containerRef  = useRef<HTMLDivElement>(null);
  const mainPaneWrapRef = useRef<HTMLDivElement>(null);
  const mainPaneRef   = useRef<HTMLDivElement>(null);
  const lowerPaneRefs = useRef<Partial<Record<LowerPaneId | "custom", HTMLDivElement | null>>>({});
  const chartRef      = useRef<ChartObj | null>(null);
  const lowerChartRefs = useRef<Map<string, ChartObj>>(new Map());
  const seriesRef     = useRef<SeriesObj | null>(null);
  const indicatorSeriesRef = useRef<Map<string, SeriesObj>>(new Map());
  const chartIndicatorsRef = useRef(chartIndicators);
  const structureKeyRef = useRef("");
  const candlesRef      = useRef(candles);
  const rawCandlesRef     = useRef(rawCandles);
  const visibleBarsRef  = useRef(visibleBars);
  const prevBarCountRef = useRef(0);
  const priceLinesRef = useRef<unknown[]>([]);
  const activeToolRef = useRef(activeTool);
  const chartTypeRef  = useRef(chartType);

  candlesRef.current = candles;
  rawCandlesRef.current = rawCandles;
  visibleBarsRef.current = visibleBars;
  chartIndicatorsRef.current = chartIndicators;

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { chartTypeRef.current = chartType;   }, [chartType]);

  // ── Live tick → active bar (runs after setData in the same commit) ─────────
  useLayoutEffect(() => {
    const series = seriesRef.current;
    const cList = candlesRef.current;
    if (!series || cList.length === 0) return;
    try {
      patchActiveBarOnSeries(
        series,
        null,
        cList,
        rawCandlesRef.current,
        chartTypeRef.current,
      );
      patchIndicatorSeries(indicatorSeriesRef.current, chartIndicatorsRef.current);
    } catch { /* series not ready */ }
  }, [livePrice, liveTimestamp, liveSeq, candles, rawCandles, chartIndicators]);

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

    const key = chartStructureKey(
      chartType,
      `${indicatorLayoutKey(chartIndicators)}|oi:${oiProfile?.chain ? "1" : "0"}`,
      customOverlayIndicators,
      customOscIndicators,
    );
    const dataOnly = key === structureKeyRef.current && chartRef.current && seriesRef.current;

    if (dataOnly) {
      const prevCount = prevBarCountRef.current;
      const countChanged = candles.length !== prevCount;
      prevBarCountRef.current = candles.length;

      if (countChanged) {
        seriesRef.current!.setData(mainSeriesPoints(candles, chartType));
        if (chartIndicators) {
          const all = [...chartIndicators.overlays, ...chartIndicators.panes.flatMap(p => p.series)];
          for (const spec of all) {
            const s = indicatorSeriesRef.current.get(spec.key);
            s?.setData(spec.data);
          }
        }
      } else {
        patchActiveBarOnSeries(
          seriesRef.current!,
          null,
          candles,
          rawCandles,
          chartType,
        );
        patchIndicatorSeries(indicatorSeriesRef.current, chartIndicators);
      }

      const chart = chartRef.current;
      if (chart) {
        const prevCount = prevBarCountRef.current;
        const ts = chart.timeScale();
        let atEnd = true;
        try {
          const range = ts.getVisibleLogicalRange?.();
          if (range && typeof range.to === "number") {
            atEnd = range.to >= prevCount - 8;
          }
        } catch { /* ignore */ }
        if (atEnd || countChanged) {
          applyRecentViewport(chart, candles.length, visibleBarsRef.current);
        }
      }
      return;
    }

    structureKeyRef.current = key;
    chartRef.current?.remove();
    lowerChartRefs.current.forEach(c => c.remove());
    lowerChartRefs.current.clear();
    indicatorSeriesRef.current.clear();
    chartRef.current = null;
    seriesRef.current = null;
    priceLinesRef.current = [];

    let observer: ResizeObserver | null = null;
    const paneIds = lowerPaneIds;
    const customPane = hasCustomOsc;

    import("lightweight-charts").then((lc) => {
      if (!mainPaneRef.current) return;
      const el2 = mainPaneRef.current;
      const w = el2.clientWidth  || 800;
      const totalH = containerRef.current?.clientHeight || 400;
      const layoutPaneCount = paneIds.length + (customPane ? 1 : 0);
      const { mainH, paneH } = computeChartLayout(totalH, layoutPaneCount);

      const chartOpts = {
        layout: {
          background: { type: lc.ColorType.Solid, color: "#ffffff" },
          textColor: "#64748b", fontSize: 11,
          fontFamily: "Inter, system-ui, sans-serif",
        },
        localization: nseChartLocalization,
        grid:      { vertLines: { color: "#f1f5f9" }, horzLines: { color: "#f1f5f9" } },
        crosshair: { mode: lc.CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#eef0f4" },
        timeScale: {
          borderColor: "#eef0f4",
          timeVisible: !hasLowerPanes,
          secondsVisible: false,
          rightOffset: 8,
          tickMarkFormatter: nseChartTickMarkFormatter,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
        handleScale: { mouseWheel: true, pinch: true },
      };

      const chart = lc.createChart(el2, { width: w, height: mainH, ...chartOpts }) as unknown as ChartObj;
      chartRef.current = chart;

      const priceScaleApi = chart as unknown as {
        priceScale: (id: string) => { applyOptions: (o: object) => void };
      };
      priceScaleApi.priceScale("right").applyOptions({
        scaleMargins: { top: 0.06, bottom: 0.08 },
      });

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

      // ── Built-in overlay indicators (engine) ─────────────────────────────
      if (chartIndicators) {
        for (const spec of chartIndicators.overlays) {
          const s = mountIndicatorSeries(lc, chart, spec, "main");
          indicatorSeriesRef.current.set(spec.key, s);
        }
      }

      // ── Custom formula overlays ───────────────────────────────────────────
      for (const ci of customOverlayIndicators) {
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

      const lowerCharts: ChartObj[] = [];

      for (const paneDef of chartIndicators?.panes ?? []) {
        const el = lowerPaneRefs.current[paneDef.pane];
        if (!el) continue;
        const paneChart = lc.createChart(el, {
          width: w,
          height: paneH,
          ...chartOpts,
          timeScale: {
            ...chartOpts.timeScale,
            visible: paneDef.pane === paneIds[paneIds.length - 1],
          },
        }) as unknown as ChartObj;
        lowerChartRefs.current.set(paneDef.pane, paneChart);
        for (const spec of paneDef.series) {
          const s = mountIndicatorSeries(lc, paneChart, spec, paneDef.pane);
          indicatorSeriesRef.current.set(spec.key, s);
        }
        lowerCharts.push(paneChart);
      }

      if (customPane && lowerPaneRefs.current.custom) {
        const oscChart = lc.createChart(lowerPaneRefs.current.custom, {
          width: w,
          height: paneH,
          ...chartOpts,
          timeScale: { ...chartOpts.timeScale, visible: paneIds.length === 0 },
        }) as unknown as ChartObj;
        lowerChartRefs.current.set("custom", oscChart);
        for (const ci of customOscIndicators) {
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
        lowerCharts.push(oscChart);
      }

      bindTimeScales(chart, lowerCharts);
      applyRecentViewport(chart, candles.length, visibleBarsRef.current);
      prevBarCountRef.current = candles.length;

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
        const { mainH: mH, paneH: pH } = computeChartLayout(totalH, layoutPaneCount);
        chartRef.current.applyOptions({ width: tw, height: mH });
        lowerChartRefs.current.forEach(c => c.applyOptions({ width: tw, height: pH }));
      });
      observer.observe(containerRef.current ?? el2);
    });

    return () => {
      observer?.disconnect();
      chartRef.current?.remove();
      lowerChartRefs.current.forEach(c => c.remove());
      chartRef.current = null;
      lowerChartRefs.current.clear();
      seriesRef.current = null;
      indicatorSeriesRef.current.clear();
      structureKeyRef.current = "";
    };
  }, [candles, rawCandles, chartType, chartIndicators, customOverlayIndicators, customOscIndicators, lowerPaneIds, hasCustomOsc, oiProfile?.chain]);

  // Re-anchor when symbol / timeframe / period changes (structure may stay identical).
  useEffect(() => {
    const chart = chartRef.current;
    const n = candlesRef.current.length;
    if (!chart || n === 0 || !viewportResetKey) return;
    applyRecentViewport(chart, n, visibleBars);
    prevBarCountRef.current = n;
  }, [viewportResetKey, visibleBars]);

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

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div
        ref={mainPaneWrapRef}
        style={{
          position: "relative",
          flex: hasLowerPanes ? "1 1 auto" : "1 1 100%",
          minHeight: 0,
        }}
      >
        <div ref={mainPaneRef} style={{ position: "absolute", inset: 0 }} />
        {oiProfile?.chain && (
          <OiProfileOverlay
            chain={oiProfile.chain}
            symbolLabel={oiProfile.symbolLabel}
            chartRef={chartRef as RefObject<{ timeScale: () => { subscribeVisibleLogicalRangeChange?: (fn: () => void) => void; unsubscribeVisibleLogicalRangeChange?: (fn: () => void) => void } } | null>}
            seriesRef={seriesRef as RefObject<{ priceToCoordinate?: (price: number) => number | null } | null>}
            paneRef={mainPaneWrapRef}
            refreshKey={oiProfile.refreshKey}
          />
        )}
      </div>
      {lowerPaneIds.map(pane => (
        <div
          key={pane}
          ref={el => { lowerPaneRefs.current[pane] = el; }}
          style={{
            flex: "0 0 auto",
            height: 100,
            borderTop: "1px solid #eef0f4",
            background: "#fafafa",
          }}
        />
      ))}
      {hasCustomOsc && (
        <div
          ref={el => { lowerPaneRefs.current.custom = el; }}
          style={{
            flex: "0 0 auto",
            height: 100,
            borderTop: "1px solid #eef0f4",
            background: "#fafafa",
          }}
        />
      )}
    </div>
  );
}
