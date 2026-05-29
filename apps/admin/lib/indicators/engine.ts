import type { Candle } from "@/lib/angelone-types";
import { parseCandleTimestampToUnix } from "@/lib/nse-market-time";
import { BUILTIN_INDICATOR_IDS, INDICATOR_REGISTRY, PANE_ORDER } from "./registry";
import type {
  ChartIndicatorOutput,
  IndicatorContext,
  IndicatorPane,
  IndicatorSeriesOutput,
} from "./types";

export function buildIndicatorContext(candles: Candle[]): IndicatorContext | null {
  if (candles.length === 0) return null;
  return {
    candles,
    times: candles.map(c => parseCandleTimestampToUnix(c.timestamp)),
    open: candles.map(c => c.open),
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    volume: candles.map(c => Math.max(0, Number(c.volume) || 0)),
  };
}

/**
 * Compute all active built-in indicators from OHLCV candles.
 * Re-run on every candle array change (including live ticks).
 */
export function runIndicatorEngine(
  candles: Candle[],
  activeIds: Iterable<string>,
): ChartIndicatorOutput {
  const empty: ChartIndicatorOutput = { overlays: [], panes: [] };
  const ctx = buildIndicatorContext(candles);
  if (!ctx) return empty;

  const overlays: IndicatorSeriesOutput[] = [];
  const paneMap = new Map<Exclude<IndicatorPane, "overlay">, IndicatorSeriesOutput[]>();

  for (const id of activeIds) {
    if (!BUILTIN_INDICATOR_IDS.has(id)) continue;
    const spec = INDICATOR_REGISTRY[id];
    if (!spec) continue;
    const { series } = spec.compute(ctx);
    for (const s of series) {
      if (s.pane === "overlay") overlays.push(s);
      else {
        const list = paneMap.get(s.pane) ?? [];
        list.push(s);
        paneMap.set(s.pane, list);
      }
    }
  }

  const panes = PANE_ORDER
    .filter(p => (paneMap.get(p)?.length ?? 0) > 0)
    .map(pane => ({ pane, series: paneMap.get(pane)! }));

  return { overlays, panes };
}

/** Last point per series — for lightweight-charts `series.update()` on live ticks. */
export function lastPointsPerSeries(
  output: ChartIndicatorOutput,
): Map<string, { time: number; value: number; color?: string }> {
  const map = new Map<string, { time: number; value: number; color?: string }>();
  const all = [
    ...output.overlays,
    ...output.panes.flatMap(p => p.series),
  ];
  for (const s of all) {
    const last = s.data[s.data.length - 1];
    if (last) map.set(s.key, last);
  }
  return map;
}

export { INDICATOR_REGISTRY, BUILTIN_INDICATOR_IDS };
