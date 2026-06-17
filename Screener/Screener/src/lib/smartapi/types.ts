export type SmartApiInterval =
  | "ONE_MINUTE"
  | "THREE_MINUTE"
  | "FIVE_MINUTE"
  | "FIFTEEN_MINUTE"
  | "THIRTY_MINUTE"
  | "ONE_HOUR"
  | "ONE_DAY";

/** Sub-minute display intervals (built from live LTP polling) */
export type SecondInterval = "SEC_15" | "SEC_30" | "SEC_45";

export type ChartTimeframe = SmartApiInterval | SecondInterval;

export interface SmartApiEnvelope<T> {
  status: boolean;
  message: string;
  errorcode: string;
  data: T;
}

export interface SmartApiSession {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
}

export interface ScripSearchResult {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
}

export type CandleTuple = [string, number, number, number, number, number];

export interface ResolvedSymbol {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
  displayName: string;
}

export interface OptionGreekRow {
  name: string;
  expiry: string;
  strikePrice: string;
  optionType: "CE" | "PE";
  delta: string;
  gamma: string;
  theta: string;
  vega: string;
  impliedVolatility: string;
  tradeVolume: string;
}

export interface OptionChainStrike {
  strike: number;
  ce?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    iv: number;
    volume: number;
  };
  pe?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    iv: number;
    volume: number;
  };
}
