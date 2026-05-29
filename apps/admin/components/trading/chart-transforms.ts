import type { Candle } from "@/lib/angelone-types";

/** Merge N consecutive candles (same order) into one bar */
export function aggregateCandles(candles: Candle[], factor: number): Candle[] {
  if (factor <= 1 || candles.length === 0) return candles;
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const chunk = candles.slice(i, i + factor);
    if (chunk.length === 0) continue;
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    out.push({
      timestamp: first.timestamp,
      open: first.open,
      high: Math.max(...chunk.map(c => c.high)),
      low: Math.min(...chunk.map(c => c.low)),
      close: last.close,
      volume: chunk.reduce((s, c) => s + c.volume, 0),
    });
  }
  return out;
}

export function toHeikinAshi(candles: Candle[]): Candle[] {
  if (candles.length === 0) return [];
  const out: Candle[] = [];
  let prevOpen = candles[0].open;
  let prevClose = candles[0].close;

  for (const c of candles) {
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = out.length === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    out.push({
      timestamp: c.timestamp,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: c.volume,
    });
    prevOpen = haOpen;
    prevClose = haClose;
  }
  return out;
}

/** Simple fixed-brick Renko from close prices */
export function toRenko(candles: Candle[], brickPct = 0.1): Candle[] {
  if (candles.length < 2) return candles;
  const brick = Math.max(candles[0].close * (brickPct / 100), 0.01);
  const out: Candle[] = [];
  let last = candles[0].close;
  let dir = 0;
  let open = last;
  let high = last;
  let low = last;

  for (let i = 1; i < candles.length; i++) {
    const price = candles[i].close;
    while (price >= last + brick) {
      if (dir <= 0) { open = last; high = last + brick; low = last; }
      else { open = last; high = last + brick; low = last; }
      last += brick;
      dir = 1;
      out.push({ timestamp: candles[i].timestamp, open, high: last, low: open, close: last, volume: 0 });
    }
    while (price <= last - brick) {
      if (dir >= 0) { open = last; high = last; low = last - brick; }
      else { open = last; high = last; low = last - brick; }
      last -= brick;
      dir = -1;
      out.push({ timestamp: candles[i].timestamp, open, high: open, low: last, close: last, volume: 0 });
    }
  }
  return out.length ? out : candles;
}

export function applyTimeframePipeline(candles: Candle[], aggregate?: number): Candle[] {
  if (!aggregate || aggregate <= 1) return candles;
  return aggregateCandles(candles, aggregate);
}
