import type { Candle } from "@/lib/angelone-types";
import { parseCandleTimestampToUnix, unixSecToIsoIst } from "@/lib/nse-market-time";

export type LiveQuoteTick = {
  ltp: number;
  /** Unix seconds — open of the active interval bucket (IST/NSE). */
  bucketOpenUnix: number;
  /** Session cumulative volume from quote (optional). */
  sessionVolume?: number;
};

function barUnix(c: Candle): number {
  return parseCandleTimestampToUnix(c.timestamp);
}

/**
 * Merge a live LTP into the candle array: update the active bar tick-by-tick,
 * or append a new bar when the bucket advances. Does not wait for interval close.
 */
export function applyLiveQuoteToCandles(
  candles: Candle[],
  tick: LiveQuoteTick,
): Candle[] {
  const { ltp, bucketOpenUnix, sessionVolume } = tick;
  if (!candles.length || !Number.isFinite(ltp) || ltp <= 0) return candles;
  if (!Number.isFinite(bucketOpenUnix)) return candles;

  const out = candles.slice();
  const lastIdx = out.length - 1;
  const last = out[lastIdx];
  const lastT = barUnix(last);

  if (!Number.isFinite(lastT)) return candles;

  if (bucketOpenUnix > lastT) {
    out.push({
      timestamp: unixSecToIsoIst(bucketOpenUnix),
      open: ltp,
      high: ltp,
      low: ltp,
      close: ltp,
      volume: sessionVolume && sessionVolume > 0 ? sessionVolume : 0,
    });
    return out;
  }

  if (bucketOpenUnix < lastT) {
    for (let i = out.length - 1; i >= 0; i--) {
      if (barUnix(out[i]) !== bucketOpenUnix) continue;
      const c = out[i];
      out[i] = {
        ...c,
        close: ltp,
        high: Math.max(c.high, ltp),
        low: Math.min(c.low, ltp),
        volume: pickVolume(c.volume, sessionVolume),
      };
      return out;
    }
    return candles;
  }

  out[lastIdx] = {
    ...last,
    close: ltp,
    high: Math.max(last.high, ltp),
    low: Math.min(last.low, ltp),
    volume: pickVolume(last.volume, sessionVolume),
  };
  return out;
}

function pickVolume(barVol: number, sessionVol?: number): number {
  if (sessionVol != null && sessionVol > 0) return sessionVol;
  return Math.max(0, Number(barVol) || 0);
}

/** OHLC row for header — close always matches live LTP. */
export function liveHeaderOhlc(
  last: Candle | undefined,
  ltp: number | undefined,
): { open: number; high: number; low: number; close: number; volume: number } | null {
  if (!last || ltp == null || !Number.isFinite(ltp)) return null;
  return {
    open: last.open,
    high: Math.max(last.high, ltp),
    low: Math.min(last.low, ltp),
    close: ltp,
    volume: last.volume,
  };
}
