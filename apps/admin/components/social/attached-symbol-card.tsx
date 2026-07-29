"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import { fetchLiveQuote } from "@/lib/market-quote-client";
import MiniSparkline from "./mini-sparkline";
import type { SocialPostSymbol } from "@/lib/social-feed-types";

export type AttachedSymbol = {
  symbol: string;
  tradingSymbol: string;
  exchange: string;
  token: string;
  instrumentType?: string;
};

type Quote = { ltp: number; changePct: number };

export default function AttachedSymbolCard({
  item,
  onRemove,
  compact = false,
  variant = "composer",
}: {
  item: AttachedSymbol | SocialPostSymbol;
  onRemove?: () => void;
  compact?: boolean;
  variant?: "composer" | "feed";
}) {
  const token = "token" in item ? item.token ?? "" : "";
  const exchange = item.exchange ?? "NSE";
  const tradingSymbol = ("tradingSymbol" in item ? item.tradingSymbol : item.trading_symbol) ?? item.symbol;
  const symbol = item.symbol;
  const instrumentType =
    "instrumentType" in item && item.instrumentType
      ? item.instrumentType
      : undefined;

  const [quote, setQuote] = useState<Quote | null>(null);

  const streamKey = useMemo(
    () => (token ? `${exchange}:${token}` : ""),
    [exchange, token],
  );

  const fetchQuote = useCallback(async () => {
    if (!token) return;
    const q = await fetchLiveQuote({ token, exchange, tradingSymbol, instrumentType });
    if (q) setQuote(q);
  }, [token, exchange, tradingSymbol, instrumentType]);

  useEffect(() => {
    fetchQuote();
    const id = setInterval(fetchQuote, 8000);
    return () => clearInterval(id);
  }, [fetchQuote]);

  useEffect(() => {
    if (!streamKey || !token) return;
    const url = `/api/v1/market/stream?symbols=${encodeURIComponent(streamKey)}`;
    const es = new EventSource(url);
    es.onmessage = ev => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "tick" && data.token === token && data.ltp > 0) {
          setQuote(prev => ({
            ltp: Number(data.ltp),
            changePct: prev?.changePct ?? 0,
          }));
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [streamKey, token]);

  const up = (quote?.changePct ?? 0) >= 0;
  const isFeed = variant === "feed";

  return (
    <div
      className={`sf-symbol-card${compact ? " compact" : ""}${isFeed ? " sf-symbol-card-feed" : ""}`}
    >
      {onRemove && (
        <button type="button" className="sf-symbol-remove" onClick={onRemove} aria-label="Remove">
          <FiX size={12} />
        </button>
      )}
      <div className="sf-symbol-card-left">
        <div className="sf-symbol-icon">${symbol.slice(0, 1)}</div>
        <div className="sf-symbol-info">
          <span className="sf-symbol-ticker">${symbol}</span>
          <span className="sf-symbol-exch">{exchange}</span>
        </div>
      </div>
      {token && !compact && (
        <MiniSparkline token={token} exchange={exchange} tradingSymbol={tradingSymbol} />
      )}
      <div className="sf-symbol-card-right">
        <span className="sf-symbol-price">
          {quote
            ? `₹${quote.ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
            : "—"}
        </span>
        <span className={`sf-symbol-chg ${up ? "up" : "down"}`}>
          {quote
            ? `${up ? "+" : ""}${quote.changePct.toFixed(2)}%`
            : "—"}
        </span>
      </div>
    </div>
  );
}
