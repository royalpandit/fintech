import type { Candle, CandleInterval } from "@/lib/angelone";
import { getCandles, searchSymbol } from "@/lib/angelone";
import { parseCandleTimestampToUnix } from "@/lib/nse-market-time";

const INDEX_FUT_SEARCH: Record<string, { exchange: string; query: string }> = {
  "99926000": { exchange: "NFO", query: "NIFTY" },
  "99926009": { exchange: "NFO", query: "BANKNIFTY" },
  "99919000": { exchange: "BFO", query: "SENSEX" },
};

function candleEpochSec(timestamp: string): number {
  return parseCandleTimestampToUnix(timestamp);
}

async function nearestFutureToken(symboltoken: string): Promise<{ exchange: string; token: string } | null> {
  const hint = INDEX_FUT_SEARCH[symboltoken];
  if (!hint) return null;

  const rows = await searchSymbol(hint.exchange, hint.query);
  const futs = rows.filter(r => {
    if (!/^\d+$/.test(r.token)) return false;
    if (/\s/.test(r.tradingSymbol)) return false;
    return r.instrumentType === "FUT" || /FUT$/i.test(r.tradingSymbol);
  });
  if (!futs.length) return null;

  const monthly = futs.filter(r => /^[A-Z]+\d{2}[A-Z]{3}\d{2}FUT$/i.test(r.tradingSymbol));
  const pool = monthly.length ? monthly : futs;

  const ranked = [...pool].sort((a, b) => {
    const score = (s: string) => {
      const u = s.toUpperCase();
      if (/^\w+\d{2}\w{3}\d{2}FUT$/.test(u)) return 0;
      if (u.includes("NEXT") || u.includes("MID") || u.includes("FAR")) return 2;
      return 1;
    };
    return score(a.tradingSymbol) - score(b.tradingSymbol) || a.tradingSymbol.localeCompare(b.tradingSymbol);
  });

  const pick = ranked[0];
  return pick ? { exchange: pick.exchange, token: pick.token } : null;
}

export type CandleFetchParams = {
  exchange: string;
  symboltoken: string;
  tradingSymbol?: string;
  instrumentType?: string;
  interval: CandleInterval;
  fromdate: string;
  todate: string;
};

/** Index spot candles have volume=0 from Angel; merge nearest futures OHLCV volume by timestamp. */
export async function enrichCandlesWithVolume(
  candles: Candle[],
  params: CandleFetchParams,
): Promise<Candle[]> {
  const normalized = candles.map(c => ({
    ...c,
    volume: Math.max(0, Number(c.volume) || 0),
  }));

  if (normalized.some(c => c.volume > 0)) return normalized;

  const isIndex =
    params.instrumentType === "INDEX" || /^999\d+/.test(params.symboltoken);
  if (!isIndex || normalized.length === 0) return normalized;

  const fut = await nearestFutureToken(params.symboltoken);
  if (!fut) return normalized;

  try {
    const futCandles = await getCandles({
      exchange: fut.exchange,
      symboltoken: fut.token,
      interval: params.interval,
      fromdate: params.fromdate,
      todate: params.todate,
    });

    const volByTime = new Map(
      futCandles.map(c => [candleEpochSec(c.timestamp), Math.max(0, Number(c.volume) || 0)]),
    );

    const merged = normalized.map(c => ({
      ...c,
      volume: volByTime.get(candleEpochSec(c.timestamp)) ?? 0,
    }));

    if (merged.some(c => c.volume > 0)) return merged;
  } catch (err) {
    console.warn("[chart-volume] futures volume merge failed:", err);
  }

  return normalized;
}
