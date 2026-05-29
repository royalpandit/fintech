import type { OptionLeg } from "@/lib/angelone-types";
import type { WatchlistItem } from "./trading-terminal-types";

export function optionLegToWatchlist(
  leg: OptionLeg,
  exchange: string,
  underlying: string,
  expiryLabel: string,
  strike: number,
  side: "CE" | "PE",
): WatchlistItem {
  return {
    display: `${underlying} ${expiryLabel} ${strike} ${side}`,
    tradingSymbol: leg.tradingsymbol,
    token: leg.token,
    exchange,
    type: "OPT",
    ltp: leg.ltp,
    change: leg.change,
    changePct: leg.changePct,
  };
}
