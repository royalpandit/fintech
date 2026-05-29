"use client";

import { useSyncExternalStore } from "react";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";
import {
  addWatchlistItem as apiAddItem,
  createWatchlist as apiCreateList,
  deleteWatchlist as apiDeleteList,
  fetchWatchlists,
  moveWatchlistItem as apiMoveItem,
  removeWatchlistItem as apiRemoveItem,
  renameWatchlist as apiRenameList,
  reorderWatchlistItems as apiReorderItems,
  reorderWatchlists as apiReorderLists,
  type StoredWatchlistItem,
  type UserWatchlist,
} from "@/lib/watchlist-client";

export type { StoredWatchlistItem, UserWatchlist };

type WatchlistState = {
  lists: UserWatchlist[];
  activeId: number | null;
  loading: boolean;
  error: string | null;
  version: number;
};

const ACTIVE_KEY = "flexi-watchlist-active-id";
const CHANNEL = "flexi-watchlists-sync";

let state: WatchlistState = {
  lists: [],
  activeId: null,
  loading: false,
  error: null,
  version: 0,
};

const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let refreshPromise: Promise<void> | null = null;

function bump(partial: Partial<WatchlistState>) {
  state = { ...state, ...partial, version: state.version + 1 };
  listeners.forEach(l => l());
}

function initChannel() {
  if (typeof window === "undefined" || channel) return;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => {
    void refresh({ silent: true });
  };
}

function notifyPeers() {
  channel?.postMessage({ t: "refresh", v: Date.now() });
}

function readStoredActiveId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ACTIVE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function persistActiveId(id: number | null) {
  if (typeof window === "undefined") return;
  if (id == null) sessionStorage.removeItem(ACTIVE_KEY);
  else sessionStorage.setItem(ACTIVE_KEY, String(id));
}

/** Flatten all symbols across lists (deduped) for live quotes. */
export function allWatchlistItems(lists: UserWatchlist[]): WatchlistItem[] {
  const seen = new Set<string>();
  const out: WatchlistItem[] = [];
  for (const list of lists) {
    for (const it of list.items) {
      const key = `${it.exchange}:${it.token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        display: it.display,
        tradingSymbol: it.tradingSymbol,
        token: it.token,
        exchange: it.exchange,
        type: it.type,
      });
    }
  }
  return out;
}

export function activeWatchlist(lists: UserWatchlist[], activeId: number | null) {
  return lists.find(l => l.id === activeId) ?? lists[0] ?? null;
}

export async function refresh(opts?: { silent?: boolean }) {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    initChannel();
    if (!opts?.silent) bump({ loading: true, error: null });

    try {
      const lists = await fetchWatchlists();
      const stored = readStoredActiveId();
      const activeId =
        stored && lists.some(l => l.id === stored)
          ? stored
          : lists[0]?.id ?? null;
      persistActiveId(activeId);
      bump({ lists, activeId, loading: false, error: null });
    } catch (e) {
      bump({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load watchlists",
      });
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export function setActiveWatchlistId(id: number | null) {
  persistActiveId(id);
  bump({ activeId: id });
}

export async function createWatchlist(name: string) {
  const list = await apiCreateList(name);
  await refresh({ silent: true });
  setActiveWatchlistId(list.id);
  notifyPeers();
  return list;
}

export async function renameWatchlist(id: number, name: string) {
  await apiRenameList(id, name);
  await refresh({ silent: true });
  notifyPeers();
}

export async function deleteWatchlist(id: number) {
  await apiDeleteList(id);
  await refresh({ silent: true });
  if (state.activeId === id) {
    setActiveWatchlistId(state.lists[0]?.id ?? null);
  }
  notifyPeers();
}

export async function reorderWatchlists(order: { id: number; sort_order: number }[]) {
  await apiReorderLists(order);
  await refresh({ silent: true });
  notifyPeers();
}

export async function addWatchlistItem(watchlistId: number, item: WatchlistItem) {
  await apiAddItem(watchlistId, item);
  await refresh({ silent: true });
  notifyPeers();
}

export async function removeWatchlistItem(watchlistId: number, item: StoredWatchlistItem) {
  await apiRemoveItem(watchlistId, item);
  await refresh({ silent: true });
  notifyPeers();
}

export async function reorderWatchlistItems(
  watchlistId: number,
  order: { id: number; sort_order: number }[],
) {
  await apiReorderItems(watchlistId, order);
  await refresh({ silent: true });
  notifyPeers();
}

export async function moveWatchlistItem(itemId: number, targetWatchlistId: number) {
  await apiMoveItem(itemId, targetWatchlistId);
  await refresh({ silent: true });
  setActiveWatchlistId(targetWatchlistId);
  notifyPeers();
}

export function subscribe(listener: () => void) {
  initChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWatchlistSnapshot(): WatchlistState {
  return state;
}

export function useWatchlistStore() {
  const snap = useSyncExternalStore(subscribe, getWatchlistSnapshot, getWatchlistSnapshot);
  return snap;
}
