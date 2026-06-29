import type { AssetType } from "@prisma/client";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";

export function instrumentKey(exchange: string, token: string): string {
  return `${exchange.toUpperCase()}:${token}`;
}

export function itemToWatchlist(row: {
  symbol: string;
  displayName: string | null;
  tradingSymbol: string | null;
  token: string | null;
  exchange: string | null;
  instrumentType: string | null;
}): WatchlistItem {
  return {
    display: row.displayName ?? row.symbol.replace(/-EQ$/i, ""),
    tradingSymbol: row.tradingSymbol ?? row.symbol,
    token: row.token ?? "",
    exchange: row.exchange ?? "NSE",
    type: row.instrumentType ?? "EQ",
  };
}

/** Default portfolio watchlist — direct "Add" instead of picker modal. */
export function isPortfolioWatchlist(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "my portfolio" || n === "portfolio";
}

export function watchlistItemPayload(item: WatchlistItem) {
  const exchange = item.exchange || "NSE";
  const token = item.token || item.tradingSymbol;
  const key = instrumentKey(exchange, token);
  return {
    symbol: item.display || item.tradingSymbol,
    instrumentKey: key,
    displayName: item.display,
    tradingSymbol: item.tradingSymbol,
    token: item.token,
    exchange,
    instrumentType: item.type || "EQ",
    assetType: "equity" as AssetType,
  };
}
