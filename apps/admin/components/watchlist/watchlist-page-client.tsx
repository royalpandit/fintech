"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WatchlistPanel from "@/components/trading/watchlist-panel";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";
import {
  activeWatchlist,
  refresh,
  useWatchlistStore,
} from "@/lib/watchlist-store";

const FALLBACK: WatchlistItem = {
  display: "NIFTY 50",
  tradingSymbol: "NIFTY 50",
  token: "99926000",
  exchange: "NSE",
  type: "INDEX",
};

export default function WatchlistPageClient() {
  const router = useRouter();
  const { lists, activeId, loading, error, version } = useWatchlistStore();
  const list = activeWatchlist(lists, activeId);
  const items = list?.items ?? [];

  const [selected, setSelected] = useState<WatchlistItem>(FALLBACK);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (items.length) {
      const match = items.find(
        i => i.token === selected.token && i.exchange === selected.exchange,
      );
      if (!match) setSelected(items[0]);
    }
  }, [items, activeId, version, selected.token, selected.exchange]);

  const symbolCount = useMemo(
    () => lists.reduce((n, l) => n + l.items.length, 0),
    [lists],
  );

  const goMarkets = (item?: WatchlistItem) => {
    const q = item?.display ?? item?.tradingSymbol;
    router.push(q ? `/user/markets?q=${encodeURIComponent(q)}` : "/user/markets");
  };

  return (
    <section className="wl-page">
      <div className="wl-page-header">
        <div>
          <h1 className="wl-page-title">Watchlist</h1>
          <p className="wl-page-sub">
            {loading
              ? "Loading…"
              : error
                ? error
                : `${symbolCount} symbol${symbolCount !== 1 ? "s" : ""} across ${lists.length} list${lists.length !== 1 ? "s" : ""} — synced with Markets`}
          </p>
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
        />
      </article>

      {!loading && !error && items.length === 0 && (
        <p className="wl-page-hint">
          Create a list above and search symbols, or open{" "}
          <Link href="/user/markets">Markets</Link> to add from live search.
        </p>
      )}
    </section>
  );
}
