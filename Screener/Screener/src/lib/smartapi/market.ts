import { getCandleDateRange } from "./dates";
import { getMaxDays } from "./intervals";
import { smartApiFetch } from "./session";
import type { CandleTuple, ResolvedSymbol, SmartApiInterval } from "./types";

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LtpQuote {
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function parseCandles(data: CandleTuple[]): ChartCandle[] {
  return data
    .map(([timestamp, open, high, low, close]) => ({
      time: Math.floor(new Date(timestamp).getTime() / 1000),
      open,
      high,
      low,
      close,
    }))
    .filter((c) => Number.isFinite(c.time))
    .sort((a, b) => a.time - b.time);
}

export async function fetchCandles(
  symbol: ResolvedSymbol,
  interval: SmartApiInterval,
): Promise<ChartCandle[]> {
  const maxDays = getMaxDays(interval);
  const { fromdate, todate } = getCandleDateRange(maxDays);

  const data = await smartApiFetch<CandleTuple[]>(
    "/rest/secure/angelbroking/historical/v1/getCandleData",
    {
      method: "POST",
      body: {
        exchange: symbol.exchange,
        symboltoken: symbol.symboltoken,
        interval,
        fromdate,
        todate,
      },
    },
  );

  return parseCandles(data ?? []);
}

export async function fetchLtp(symbol: ResolvedSymbol): Promise<LtpQuote> {
  const data = await smartApiFetch<{
    ltp: string | number;
    open: string | number;
    high: string | number;
    low: string | number;
    close: string | number;
  }>("/rest/secure/angelbroking/order/v1/getLtpData", {
    method: "POST",
    body: {
      exchange: symbol.exchange,
      tradingsymbol: symbol.tradingsymbol,
      symboltoken: symbol.symboltoken,
    },
  });

  const toPrice = (v: string | number) => {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return n > 100000 ? n / 100 : n;
  };

  return {
    ltp: toPrice(data.ltp),
    open: toPrice(data.open),
    high: toPrice(data.high),
    low: toPrice(data.low),
    close: toPrice(data.close),
  };
}
