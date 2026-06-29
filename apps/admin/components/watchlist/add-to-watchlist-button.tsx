"use client";

import { useEffect, useState } from "react";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";
import {
  activeWatchlist,
  addWatchlistItem,
  createWatchlist,
  getWatchlistSnapshot,
  refresh,
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
  const [open, setOpen] = useState(false);
  const [pickerListId, setPickerListId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const active = activeWatchlist(lists, activeId);
    setPickerListId(active?.id ?? lists[0]?.id ?? null);
  }, [open, lists, activeId]);

  async function handleOpen() {
    if (!mounted) return;
    let snap = getWatchlistSnapshot();
    if (!snap.lists.length) {
      await refresh({ silent: true });
      snap = getWatchlistSnapshot();
    }
    if (!snap.lists.length) {
      alert(snap.error ?? "Sign in to save watchlists");
      return;
    }
    setOpen(true);
  }

  async function handleAdd() {
    if (pickerListId == null) return;
    setSaving(true);
    try {
      await addWatchlistItem(pickerListId, item);
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to add");
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
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create watchlist");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return (
    <>
      <button
        type="button"
        className={`mkt-add-wl${compact ? " mkt-add-wl-compact" : ""}${className ? ` ${className}` : ""}`}
        title="Add to watchlist"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          void handleOpen();
        }}
      >
        + {label}
      </button>

      {open && (
        <div className="wl-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="wl-modal" onClick={e => e.stopPropagation()}>
            <h3>Add to Watchlist</h3>
            <p className="wl-modal-sub">
              {item.display} · {item.exchange}
            </p>
            <div className="wl-picker-list">
              {lists.map(list => (
                <label key={list.id} className="wl-picker-item">
                  <input
                    type="radio"
                    name="mkt-wl-pick"
                    checked={pickerListId === list.id}
                    onChange={() => setPickerListId(list.id)}
                  />
                  <span>{list.name}</span>
                </label>
              ))}
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
