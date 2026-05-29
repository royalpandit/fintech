export type UtilityPanelId =
  | "watchlist"
  | "positions"
  | "orders"
  | "depth"
  | "optionChain"
  | "holdings"
  | "history"
  | "more";

export const UTILITY_PANEL_LABELS: Record<UtilityPanelId, string> = {
  watchlist: "Watchlist",
  positions: "Positions",
  orders: "Orders",
  depth: "Market Depth",
  optionChain: "Option Chain",
  holdings: "Holdings",
  history: "Trade History",
  more: "More",
};
