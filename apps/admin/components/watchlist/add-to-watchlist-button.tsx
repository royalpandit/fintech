"use client";

import { useEffect, useMemo, useState } from "react";
import { FiStar } from "react-icons/fi";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";
import { instrumentKey } from "@/lib/watchlist-db";
import { useToast } from "@/components/toast";
import {
  activeWatchlist,
  addWatchlistItem,
  createWatchlist,
  getWatchlistSnapshot,
  refresh,
  removeWatchlistItem,
  useWatchlistStore,
} from "@/lib/watchlist-store";

type Props = {
  item: WatchlistItem;
  className?: string;
  label?: string;
  compact?: boolean;
};

export default function AddToWatchlistButton({
  item,
  className = "",
  label = "Add",
  compact = false,
}: Props) {
  const { lists, activeId } = useWatchlistStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pickerListId, setPickerListId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Which lists already hold this instrument — drives the filled star and lets
  // the picker mark the lists it's already in.
  const key = item.token ? instrumentKey(item.exchange, item.token) : null;
  const holdings = useMemo(() => {
    if (!key) return [];
    return lists.flatMap((list) => {
      const stored = list.items.find((it) => it.instrument_key === key);
      return stored ? [{ listId: list.id, listName: list.name, stored }] : [];
    });
  }, [lists, key]);
  const listIdsHolding = useMemo(
    () => new Set(holdings.map((h) => h.listId)),
    [holdings],
  );
  const isWatchlisted = holdings.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  // The star can only reflect reality once the lists are loaded — pull them in
  // on mount rather than waiting for the user to open the picker.
  useEffect(() => {
    if (!getWatchlistSnapshot().lists.length) void refresh({ silent: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    // Default the picker to a list that doesn't already have it.
    const active = activeWatchlist(lists, activeId);
    const preferred =
      (active && !listIdsHolding.has(active.id) ? active.id : null) ??
      lists.find((l) => !listIdsHolding.has(l.id))?.id ??
      active?.id ??
      lists[0]?.id ??
      null;
    setPickerListId(preferred);
  }, [open, lists, activeId, listIdsHolding]);

  // A filled star means "remove me" — that's what users expect from a toggle.
  // Only when it's in several lists do we fall back to the picker.
  async function handleRemove() {
    if (removing || holdings.length !== 1) return;
    const [only] = holdings;
    setRemoving(true);
    try {
      await removeWatchlistItem(only.listId, only.stored);
      toast.show(`${item.display} removed from ${only.listName}`, "info");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed to remove", "error");
    } finally {
      setRemoving(false);
    }
  }

  async function handleOpen() {
    if (!mounted) return;
    let snap = getWatchlistSnapshot();
    if (!snap.lists.length) {
      await refresh({ silent: true });
      snap = getWatchlistSnapshot();
    }
    if (!snap.lists.length) {
      toast.show(snap.error ?? "Sign in to save watchlists", "error");
      return;
    }
    setOpen(true);
  }

  async function handleAdd() {
    if (pickerListId == null) return;
    const listName = lists.find((l) => l.id === pickerListId)?.name ?? "watchlist";
    setSaving(true);
    try {
      await addWatchlistItem(pickerListId, item);
      setOpen(false);
      toast.show(`${item.display} added to ${listName}`, "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed to add", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    const name = newListName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const list = await createWatchlist(name);
      await addWatchlistItem(list.id, item);
      setShowCreate(false);
      setOpen(false);
      setNewListName("");
      toast.show(`${item.display} added to ${name}`, "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed to create watchlist", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return (
    <>
      <button
        type="button"
        className={`mkt-add-wl${compact ? " mkt-add-wl-compact" : ""}${
          isWatchlisted ? " mkt-add-wl-on" : ""
        }${className ? ` ${className}` : ""}`}
        title={
          isWatchlisted
            ? holdings.length === 1
              ? `Remove from ${holdings[0].listName}`
              : "In several watchlists — choose one to add to"
            : "Add to watchlist"
        }
        aria-pressed={isWatchlisted}
        disabled={removing}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          if (isWatchlisted && holdings.length === 1) void handleRemove();
          else void handleOpen();
        }}
      >
        <FiStar
          size={compact ? 16 : 14}
          style={isWatchlisted ? { fill: "currentColor" } : undefined}
        />
        {label ? <span>{isWatchlisted ? "Added" : label}</span> : null}
      </button>

      {open && (
        <div className="wl-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="wl-modal" onClick={e => e.stopPropagation()}>
            <h3>Add to Watchlist</h3>
            <p className="wl-modal-sub">
              {item.display} · {item.exchange}
            </p>
            <div className="wl-picker-list">
              {lists.map(list => {
                const already = listIdsHolding.has(list.id);
                return (
                  <label key={list.id} className="wl-picker-item">
                    <input
                      type="radio"
                      name="mkt-wl-pick"
                      checked={pickerListId === list.id}
                      disabled={already}
                      onChange={() => setPickerListId(list.id)}
                    />
                    <span>{list.name}</span>
                    {already && <span className="wl-picker-added">Added</span>}
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              className="wl-picker-new"
              onClick={() => {
                setOpen(false);
                setNewListName("");
                setShowCreate(true);
              }}
            >
              + Create New Watchlist
            </button>
            <div className="wl-modal-actions">
              <button type="button" className="wl-modal-cancel" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="wl-modal-primary"
                disabled={pickerListId == null || saving}
                onClick={() => void handleAdd()}
              >
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="wl-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="wl-modal" onClick={e => e.stopPropagation()}>
            <h3>Create Watchlist</h3>
            <label className="wl-modal-label">Watchlist Name</label>
            <input
              className="wl-modal-input"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              placeholder="e.g. Dividend Stocks"
              autoFocus
            />
            <div className="wl-modal-actions">
              <button type="button" className="wl-modal-cancel" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="wl-modal-primary"
                disabled={saving || !newListName.trim()}
                onClick={() => void handleCreate()}
              >
                {saving ? "Saving…" : "Create & Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function overviewRowToWatchlistItem(row: {
  symbol: string;
  token: string;
  exchange: string;
  type: string;
  ltp?: number;
  netChange?: number;
  percentChange?: number;
}): WatchlistItem {
  const display = row.symbol.replace(/-EQ$/i, "").trim();
  return {
    display,
    tradingSymbol: row.type === "EQ" ? `${display}-EQ` : row.symbol,
    token: row.token,
    exchange: row.exchange,
    type: row.type,
    ltp: row.ltp,
    change: row.netChange,
    changePct: row.percentChange,
  };
}
