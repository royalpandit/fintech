import type { WatchlistItem } from "@/components/trading/trading-terminal-types";
import { instrumentKey } from "@/lib/watchlist-db";

export type StoredWatchlistItem = WatchlistItem & {
  id: number;
  instrument_key: string;
};

export type UserWatchlist = {
  id: number;
  name: string;
  sort_order: number;
  items: StoredWatchlistItem[];
};

type WatchlistApiJson = {
  status?: boolean;
  error?: string;
  watchlists?: UserWatchlist[];
  watchlist?: UserWatchlist;
};

async function parseJson(res: Response): Promise<WatchlistApiJson> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Empty response from server — run watchlist DB migration (scripts/sql/watchlist-v2-migration.sql)"
        : `Request failed (${res.status})`,
    );
  }
  try {
    return JSON.parse(text) as WatchlistApiJson;
  } catch {
    throw new Error(`Invalid server response (${res.status})`);
  }
}

const fetchOpts: RequestInit = { cache: "no-store", credentials: "include" };

export async function fetchWatchlists(): Promise<UserWatchlist[]> {
  const res = await fetch("/api/v1/watchlists", fetchOpts);
  const json = await parseJson(res);
  if (!res.ok || json.error) throw new Error(json.error ?? "Failed to load watchlists");
  return json.watchlists ?? [];
}

export async function createWatchlist(name: string): Promise<UserWatchlist> {
  const res = await fetch("/api/v1/watchlists", {
    ...fetchOpts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const json = await parseJson(res);
  if (!json.watchlist) throw new Error(json.error ?? "Create failed");
  return json.watchlist;
}

export async function renameWatchlist(id: number, name: string) {
  const res = await fetch(`/api/v1/watchlists/${id}`, {
    ...fetchOpts,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const json = await parseJson(res);
  if (!res.ok || json.error) throw new Error(json.error ?? "Rename failed");
}

export async function deleteWatchlist(id: number) {
  const res = await fetch(`/api/v1/watchlists/${id}`, { ...fetchOpts, method: "DELETE" });
  const json = await parseJson(res);
  if (!res.ok || json.error) throw new Error(json.error ?? "Delete failed");
}

export async function reorderWatchlists(order: { id: number; sort_order: number }[]) {
  await fetch("/api/v1/watchlists", {
    ...fetchOpts,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });
}

export async function addWatchlistItem(watchlistId: number, item: WatchlistItem) {
  const res = await fetch(`/api/v1/watchlists/${watchlistId}/items`, {
    ...fetchOpts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  const json = await parseJson(res);
  if (!res.ok || json.error) throw new Error(json.error ?? "Add failed");
}

export async function removeWatchlistItem(watchlistId: number, item: StoredWatchlistItem) {
  const key = item.instrument_key || instrumentKey(item.exchange, item.token);
  await fetch(
    `/api/v1/watchlists/${watchlistId}/items?instrument_key=${encodeURIComponent(key)}`,
    { ...fetchOpts, method: "DELETE" },
  );
}

export async function reorderWatchlistItems(
  watchlistId: number,
  order: { id: number; sort_order: number }[],
) {
  await fetch(`/api/v1/watchlists/${watchlistId}/items`, {
    ...fetchOpts,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });
}

export async function moveWatchlistItem(itemId: number, targetWatchlistId: number) {
  const res = await fetch("/api/v1/watchlists/items/move", {
    ...fetchOpts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId, target_watchlist_id: targetWatchlistId }),
  });
  const json = await parseJson(res);
  if (!res.ok || json.error) throw new Error(json.error ?? "Move failed");
}
