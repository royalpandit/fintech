export interface WatchlistItem {
  display: string;
  tradingSymbol: string;
  token: string;
  exchange: string;
  type: string;
  ltp?: number;
  change?: number;
  changePct?: number;
  open?: number;
  high?: number;
  low?: number;
}
