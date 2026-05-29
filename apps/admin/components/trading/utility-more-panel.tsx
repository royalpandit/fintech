"use client";

import type { UtilityPanelId } from "./trading-utility-types";

type MoreAction = {
  id: string;
  label: string;
  description: string;
  onClick: () => void;
};

export default function UtilityMorePanel({
  onOpenPanel,
  onShowOverview,
  onShowIndicators,
}: {
  onOpenPanel: (id: UtilityPanelId) => void;
  onShowOverview: () => void;
  onShowIndicators: () => void;
}) {
  const actions: MoreAction[] = [
    {
      id: "overview",
      label: "Overview",
      description: "Symbol fundamentals & stats",
      onClick: onShowOverview,
    },
    {
      id: "indicators",
      label: "Indicators",
      description: "Add technical indicators to chart",
      onClick: onShowIndicators,
    },
    {
      id: "positions",
      label: "Positions",
      description: "Paper portfolio holdings",
      onClick: () => onOpenPanel("positions"),
    },
    {
      id: "depth",
      label: "Market Depth",
      description: "Bid / ask ladder",
      onClick: () => onOpenPanel("depth"),
    },
    {
      id: "optionChain",
      label: "Option Chain",
      description: "Calls & puts for F&O",
      onClick: () => onOpenPanel("optionChain"),
    },
    {
      id: "holdings",
      label: "Holdings",
      description: "Portfolio with Buy / Sell actions",
      onClick: () => onOpenPanel("holdings"),
    },
    {
      id: "history",
      label: "Trade History",
      description: "Executed trades and realized P&L",
      onClick: () => onOpenPanel("history"),
    },
    {
      id: "watchlist",
      label: "Watchlist",
      description: "Manage symbols & lists",
      onClick: () => onOpenPanel("watchlist"),
    },
  ];

  return (
    <div className="tt-more-panel">
      <p className="tt-more-intro">Quick tools &amp; panels</p>
      <div className="tt-more-list">
        {actions.map(a => (
          <button key={a.id} type="button" className="tt-more-item" onClick={a.onClick}>
            <span className="tt-more-item-label">{a.label}</span>
            <span className="tt-more-item-desc">{a.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
