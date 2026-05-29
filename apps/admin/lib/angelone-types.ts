/**
 * Angel One types only — safe to import from client components.
 */

export type CandleInterval =
  | "ONE_MINUTE"
  | "THREE_MINUTE"
  | "FIVE_MINUTE"
  | "TEN_MINUTE"
  | "FIFTEEN_MINUTE"
  | "THIRTY_MINUTE"
  | "ONE_HOUR"
  | "ONE_DAY";

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LTPData {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ltp: number;
  percentChange: number;
  netChange: number;
}

export interface OptionLeg {
  tradingsymbol: string;
  token: string;
  ltp?: number;
  change?: number;
  changePct?: number;
  oi?: number;
  oiChange?: number;
  oiChangePct?: number;
  volume?: number;
}

export interface OptionChainRow {
  strike: number;
  ce?: OptionLeg;
  pe?: OptionLeg;
}

export interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface MarketDepthQuote {
  tradingSymbol: string;
  token: string;
  exchange: string;
  ltp: number;
  netChange: number;
  percentChange: number;
  open: number;
  high: number;
  low: number;
  close: number;
  avgPrice?: number;
  tradeVolume?: number;
  buy: DepthLevel[];
  sell: DepthLevel[];
  totalBuyQty: number;
  totalSellQty: number;
}
