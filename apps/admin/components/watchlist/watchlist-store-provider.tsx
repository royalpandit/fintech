"use client";

import { useEffect } from "react";
import { refresh } from "@/lib/watchlist-store";

/** Prefetch watchlists when user shell mounts (logged-in sessions). */
export default function WatchlistStoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void refresh();
  }, []);

  return children;
}
