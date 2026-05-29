"use client";

import { useCallback } from "react";
import RightUtilityBar from "./right-utility-bar";
import UtilityDrawer from "./utility-drawer";
import WatchlistPanel from "./watchlist-panel";
import PositionsPanel from "./positions-panel";
import OrdersDrawerPanel from "./orders-drawer-panel";
import MarketDepthPanel from "./market-depth-panel";
import OptionChainPanel from "./option-chain-panel";
import PaperHoldingsPanel from "@/components/paper/paper-holdings-panel";
import PaperTradeHistoryPanel from "@/components/paper/paper-trade-history-panel";
import UtilityMorePanel from "./utility-more-panel";
import type { UtilityPanelId } from "./trading-utility-types";
import type { WatchlistItem } from "./trading-terminal-types";

type OrderRow = { symbol: string; side: string; quantity: number; price: number };

export default function TradingUtilityShell({
  activePanel,
  onPanelChange,
  selected,
  watchlist,
  onWatchlistItemsChange,
  onSelectSymbol,
  onOpenChart,
  onBuy,
  onSell,
  orderSide,
  orders,
  onRefreshOrders,
  onOrderPlaced,
  onShowOverview,
  onShowIndicators,
  paperRefreshKey,
  onHoldingsBuy,
  onHoldingsSell,
}: {
  activePanel: UtilityPanelId | null;
  onPanelChange: (id: UtilityPanelId | null) => void;
  selected: WatchlistItem;
  watchlist: WatchlistItem[];
  onWatchlistItemsChange: (items: WatchlistItem[]) => void;
  onSelectSymbol: (item: WatchlistItem) => void;
  onOpenChart: (item: WatchlistItem) => void;
  onBuy: (item: WatchlistItem) => void;
  onSell: (item: WatchlistItem) => void;
  orderSide: "BUY" | "SELL";
  orders: OrderRow[];
  onRefreshOrders: () => void;
  onOrderPlaced: () => void;
  onShowOverview: () => void;
  onShowIndicators: () => void;
  paperRefreshKey?: number;
  onHoldingsBuy: (symbol: string) => void;
  onHoldingsSell: (symbol: string) => void;
}) {
  const togglePanel = useCallback(
    (id: UtilityPanelId) => {
      onPanelChange(activePanel === id ? null : id);
    },
    [activePanel, onPanelChange],
  );

  const close = useCallback(() => onPanelChange(null), [onPanelChange]);

  const drawerContent = (() => {
    switch (activePanel) {
      case "watchlist":
        return (
          <WatchlistPanel
            selected={selected}
            onSelect={onSelectSymbol}
            onOpenChart={onOpenChart}
            onBuy={onBuy}
            onSell={onSell}
            onItemsChange={onWatchlistItemsChange}
            liveQuotes={watchlist}
          />
        );
      case "positions":
        return <PositionsPanel liveQuotes={watchlist} refreshKey={paperRefreshKey} />;
      case "orders":
        return (
          <OrdersDrawerPanel
            symbol={selected}
            initialSide={orderSide}
            orders={orders}
            refreshKey={paperRefreshKey}
            onRefresh={onRefreshOrders}
            onOrderPlaced={onOrderPlaced}
          />
        );
      case "depth":
        return (
          <MarketDepthPanel
            symbol={selected}
            onOpenChart={() => onOpenChart(selected)}
          />
        );
      case "optionChain":
        return (
          <OptionChainPanel
            symbol={selected}
            spotLtp={selected.ltp}
            spotChangePct={selected.changePct}
            onOpenChart={onOpenChart}
          />
        );
      case "holdings":
        return (
          <PaperHoldingsPanel
            liveQuotes={watchlist}
            refreshKey={paperRefreshKey}
            onBuy={onHoldingsBuy}
            onSell={onHoldingsSell}
          />
        );
      case "history":
        return <PaperTradeHistoryPanel refreshKey={paperRefreshKey} />;
      case "more":
        return (
          <UtilityMorePanel
            onOpenPanel={id => onPanelChange(id)}
            onShowOverview={() => {
              onShowOverview();
              close();
            }}
            onShowIndicators={() => {
              onShowIndicators();
              close();
            }}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div className="tt-utility-zone">
      <UtilityDrawer open={activePanel != null} panelId={activePanel} onClose={close}>
        {drawerContent}
      </UtilityDrawer>
      <RightUtilityBar active={activePanel} onSelect={togglePanel} />
    </div>
  );
}
