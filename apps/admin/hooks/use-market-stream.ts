"use client";

import { useEffect, useRef } from "react";

export type MarketStreamTick = {
  token: string;
  exchange: string;
  ltp: number;
  volume?: number;
  ts: number;
};

/**
 * One EventSource (SSE) per component mount — subscribes to server-side Angel WebSocket.
 * Pass stable `symbols` array (e.g. useMemo) to avoid reconnect churn.
 */
export function useMarketStream(
  symbols: string[],
  onTick: (tick: MarketStreamTick) => void,
  enabled = true,
) {
  const onTickRef = useRef(onTick);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  const symbolsKey = symbols.join("|");

  useEffect(() => {
    if (!enabled || !symbols.length) return;

    const url = `/api/v1/market/stream?symbols=${encodeURIComponent(symbols.join(","))}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type?: string; token?: string; exchange?: string; ltp?: number; volume?: number; ts?: number };
        if (data.type === "tick" && data.token && data.exchange && data.ltp != null) {
          onTickRef.current({
            token: data.token,
            exchange: data.exchange,
            ltp: Number(data.ltp),
            volume: data.volume,
            ts: data.ts ?? Date.now(),
          });
        }
      } catch { /* ignore parse errors */ }
    };

    return () => es.close();
  }, [enabled, symbolsKey, symbols.length]);
}
