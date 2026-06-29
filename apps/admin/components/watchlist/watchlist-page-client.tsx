"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WatchlistPanel from "@/components/trading/watchlist-panel";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";
import {
  activeWatchlist,
  allWatchlistItems,
  useWatchlistStore,
} from "@/lib/watchlist-store";

const FALLBACK: WatchlistItem = {
  display: "NIFTY 50",
  tradingSymbol: "NIFTY 50",
  token: "99926000",
  exchange: "NSE",
  type: "INDEX",
};

const POLL_MS = 10_000;

type LiveRow = {
  symbolToken: string;
  exchange: string;
  ltp: number;
  netChange: number;
  percentChange: number;
};

function buildExtraParam(items: WatchlistItem[]): string {
  return items
    .filter(i => i.token && i.exchange && i.tradingSymbol)
    .map(i => `${i.token}:${i.exchange}:${encodeURIComponent(i.tradingSymbol)}:${i.type ?? "EQ"}`)
    .join(",");
}

export default function WatchlistPageClient() {
  const router = useRouter();
  const { lists, activeId, loading, error, version } = useWatchlistStore();
  const list = activeWatchlist(lists, activeId);
  const items = list?.items ?? [];

  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<WatchlistItem>(FALLBACK);
  const [liveQuotes, setLiveQuotes] = useState<WatchlistItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (items.length) {
      const match = items.find(
        i => i.token === selected.token && i.exchange === selected.exchange,
      );
      if (!match) setSelected(items[0]);
    }
  }, [items, activeId, version, selected.token, selected.exchange]);

  const allItems = useMemo(() => allWatchlistItems(lists), [lists]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (allItems.length === 0) return;

    let alive = true;

    const fetchPrices = async () => {
      const extra = buildExtraParam(allItems);
      if (!extra) return;
      try {
        const res = await fetch(`/api/v1/market/live?extra=${extra}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive || !json.ok) return;

        const rows: LiveRow[] = json.data ?? [];
        const quotes: WatchlistItem[] = allItems.map(item => {
          const row = rows.find(r => r.symbolToken === item.token && r.exchange === item.exchange);
          if (!row || !row.ltp) return item;
          return {
            ...item,
            ltp: row.ltp,
            change: row.netChange,
            changePct: row.percentChange,
          };
        });
        setLiveQuotes(quotes);
      } catch {
        // silent — stale prices remain
      }
    };

    void fetchPrices();
    pollRef.current = setInterval(fetchPrices, POLL_MS);

    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [allItems]);

  const symbolCount = useMemo(
    () => lists.reduce((n, l) => n + l.items.length, 0),
    [lists],
  );

  const subtitle = useMemo(() => {
    if (!mounted) return "Synced with Markets";
    if (loading) return "Loading…";
    if (error) return error;
    return `${symbolCount} symbol${symbolCount !== 1 ? "s" : ""} across ${lists.length} list${lists.length !== 1 ? "s" : ""} — synced with Markets`;
  }, [mounted, loading, error, symbolCount, lists.length]);

  const goMarkets = (item?: WatchlistItem) => {
    const q = item?.display ?? item?.tradingSymbol;
    router.push(q ? `/user/markets?q=${encodeURIComponent(q)}` : "/user/markets");
  };

  return (
    <section className="wl-page">
      <div className="wl-page-header">
        <div>
          <h1 className="wl-page-title">Watchlist</h1>
          <p className="wl-page-sub">{subtitle}</p>
        </div>
        <Link href="/user/markets" className="wl-page-markets-link">
          Open Markets
        </Link>
      </div>

      <article className="wl-page-card">
        <WatchlistPanel
          variant="page"
          selected={selected}
          onSelect={setSelected}
          onOpenChart={item => goMarkets(item)}
          onBuy={item => {
            setSelected(item);
            goMarkets(item);
          }}
          onSell={item => {
            setSelected(item);
            goMarkets(item);
          }}
          liveQuotes={liveQuotes}
        />
      </article>

      {!mounted && items.length === 0 ? null : !loading && !error && items.length === 0 && (
        <p className="wl-page-hint">
          Create a list above and search symbols, or open{" "}
          <Link href="/user/markets">Markets</Link> to add from live search.
        </p>
      )}
    </section>
  );
}
