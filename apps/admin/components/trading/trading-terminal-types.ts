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
  /**
   * Previous session close. Kept so the websocket tick path can recompute
   * change / changePct itself — it only ever updated `ltp`, which left the
   * change figures frozen at whatever the last REST poll returned.
   */
  prevClose?: number;
  /**
   * For an F&O leg, the cash symbol it is written on. No free feed charts the
   * contract itself, so this is what the chart offers instead.
   */
  underlying?: string;
}
