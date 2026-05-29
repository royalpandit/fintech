"use client";

import { useEffect, useRef, useState } from "react";
import type { WatchlistItem } from "./trading-terminal-types";
import WatchlistSearch from "./watchlist-search";
import {
  activeWatchlist,
  addWatchlistItem,
  createWatchlist,
  deleteWatchlist,
  moveWatchlistItem,
  refresh,
  removeWatchlistItem,
  renameWatchlist,
  reorderWatchlistItems,
  reorderWatchlists,
  setActiveWatchlistId,
  useWatchlistStore,
  type StoredWatchlistItem,
} from "@/lib/watchlist-store";

function fmtPct(n?: number) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export default function WatchlistPanel({
  variant = "drawer",
  selected,
  onSelect,
  onOpenChart,
  onBuy,
  onSell,
  onItemsChange,
  liveQuotes,
}: {
  variant?: "drawer" | "page";
  selected: WatchlistItem;
  onSelect: (item: WatchlistItem) => void;
  onOpenChart: (item: WatchlistItem) => void;
  onBuy: (item: WatchlistItem) => void;
  onSell: (item: WatchlistItem) => void;
  /** Optional: terminal merges live LTP into rows */
  onItemsChange?: (items: WatchlistItem[]) => void;
  liveQuotes?: WatchlistItem[];
}) {
  const { lists, activeId, loading, error: authError } = useWatchlistStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showAddPicker, setShowAddPicker] = useState<WatchlistItem | null>(null);
  const [pickerListId, setPickerListId] = useState<number | null>(null);
  const [showMove, setShowMove] = useState<StoredWatchlistItem | null>(null);
  const [menuItem, setMenuItem] = useState<StoredWatchlistItem | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const dragTabId = useRef<number | null>(null);
  const dragItemId = useRef<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const activeList = activeWatchlist(lists, activeId);
  const items: StoredWatchlistItem[] = activeList?.items ?? [];

  useEffect(() => {
    if (!lists.length && !loading) void refresh();
  }, [lists.length, loading]);

  useEffect(() => {
    onItemsChange?.(items);
  }, [items, activeId, lists, onItemsChange]);

  const displayItems = items.map(row => {
    const q = liveQuotes?.find(l => l.token === row.token && l.exchange === row.exchange);
    return q ? { ...row, ...q } : row;
  });

  const handleCreate = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      await createWatchlist(name);
      setShowCreate(false);
      setNewListName("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create");
    }
  };

  const handleAddToList = async (watchlistId: number, item: WatchlistItem) => {
    try {
      await addWatchlistItem(watchlistId, item);
      if (watchlistId === activeId) onSelect(item);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to add");
    }
  };

  const handleAddToWatchlist = (item: WatchlistItem) => {
    if (!lists.length) {
      alert(authError ?? "Sign in to save watchlists");
      return;
    }
    setPickerListId(activeId ?? lists[0]?.id ?? null);
    setShowAddPicker(item);
  };

  const handleRemove = async (row: StoredWatchlistItem) => {
    if (!activeList) return;
    try {
      await removeWatchlistItem(activeList.id, row);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Remove failed");
    }
    setMenuItem(null);
  };

  const handleMove = async (targetId: number) => {
    if (!showMove) return;
    try {
      await moveWatchlistItem(showMove.id, targetId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Move failed");
    }
    setShowMove(null);
  };

  const onTabDragStart = (id: number) => { dragTabId.current = id; };
  const onTabDrop = async (targetId: number) => {
    const from = dragTabId.current;
    dragTabId.current = null;
    if (from == null || from === targetId) return;
    const order = [...lists];
    const fi = order.findIndex(l => l.id === from);
    const ti = order.findIndex(l => l.id === targetId);
    if (fi < 0 || ti < 0) return;
    const [moved] = order.splice(fi, 1);
    order.splice(ti, 0, moved);
    const payload = order.map((l, i) => ({ id: l.id, sort_order: i }));
    await reorderWatchlists(payload);
  };

  const onItemDragStart = (id: number) => { dragItemId.current = id; };
  const onItemDrop = async (targetId: number) => {
    const from = dragItemId.current;
    dragItemId.current = null;
    if (!activeList || from == null || from === targetId) return;
    const order = [...items];
    const fi = order.findIndex(i => i.id === from);
    const ti = order.findIndex(i => i.id === targetId);
    if (fi < 0 || ti < 0) return;
    const [moved] = order.splice(fi, 1);
    order.splice(ti, 0, moved);
    const payload = order.map((it, i) => ({ id: it.id, sort_order: i }));
    await reorderWatchlistItems(activeList.id, payload);
  };

  const saveRename = async (id: number) => {
    const name = renameVal.trim();
    if (!name) return;
    try {
      await renameWatchlist(id, name);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Rename failed");
    }
    setRenamingId(null);
  };

  return (
    <div className={`wl-panel${variant === "page" ? " wl-panel-page" : ""}`}>
      {variant !== "page" && (
        <div className="wl-panel-head">
          <span className="wl-panel-title">Watchlist</span>
          <div className="wl-panel-head-actions">
            <button type="button" className="wl-icon-btn" title="Refresh" onClick={() => refresh()}>
              ↺
            </button>
          </div>
        </div>
      )}

      {variant === "page" && (
        <div className="wl-panel-head wl-panel-head-page">
          <button type="button" className="wl-icon-btn" title="Refresh" onClick={() => refresh()}>
            ↺ Sync
          </button>
        </div>
      )}

      <div className="wl-tabs-scroll" ref={tabsRef}>
        <button type="button" className="wl-tabs-arrow" onClick={() => tabsRef.current?.scrollBy({ left: -80, behavior: "smooth" })}>
          ‹
        </button>
        <div className="wl-tabs">
          {lists.map(list => (
            <div
              key={list.id}
              draggable
              onDragStart={() => onTabDragStart(list.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onTabDrop(list.id)}
              className={`wl-tab${list.id === activeId ? " active" : ""}`}
            >
              {renamingId === list.id ? (
                <input
                  className="wl-tab-rename"
                  value={renameVal}
                  autoFocus
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => saveRename(list.id)}
                  onKeyDown={e => {
                    if (e.key === "Enter") saveRename(list.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveWatchlistId(list.id)}
                  onDoubleClick={() => {
                    setRenamingId(list.id);
                    setRenameVal(list.name);
                  }}
                >
                  {list.name}
                </button>
              )}
              {list.id === activeId && lists.length > 1 && (
                <button
                  type="button"
                  className="wl-tab-del"
                  title="Delete watchlist"
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm(`Delete "${list.name}"?`)) {
                      deleteWatchlist(list.id).catch(err => alert(String(err)));
                    }
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" className="wl-tab-add" title="Create watchlist" onClick={() => setShowCreate(true)}>
            +
          </button>
        </div>
      </div>

      <WatchlistSearch
        onAddToWatchlist={handleAddToWatchlist}
        onBuy={onBuy}
        onSell={onSell}
        onOpenChart={onOpenChart}
      />

      <div className="wl-list">
        {loading && <div className="wl-list-msg">Loading…</div>}
        {authError && <div className="wl-list-msg wl-list-warn">{authError}</div>}
        {!loading && items.length === 0 && (
          <div className="wl-list-msg">Search and add symbols, or use + on a result.</div>
        )}
        {displayItems.map(row => {
          const active =
            row.token === selected.token && row.exchange === selected.exchange;
          const pos = (row.changePct ?? 0) >= 0;
          return (
            <div
              key={row.id}
              draggable
              onDragStart={() => onItemDragStart(row.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onItemDrop(row.id)}
              className={`wl-row${active ? " active" : ""}`}
            >
              <button
                type="button"
                className="wl-row-main"
                onClick={() => onSelect(row)}
                onContextMenu={e => {
                  e.preventDefault();
                  setMenuItem(row);
                }}
              >
                <div className="wl-row-left">
                  <div className="wl-row-symbol">{row.display}</div>
                  <div className="wl-row-exch">{row.exchange}</div>
                </div>
                <div className="wl-row-right">
                  <div className="wl-row-ltp">
                    <span className={pos ? "wl-arrow up" : "wl-arrow down"}>{pos ? "▲" : "▼"}</span>
                    {row.ltp ? row.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
                  </div>
                  <div className={`wl-row-chg ${pos ? "up" : "down"}`}>
                    {row.change !== undefined ? `${pos ? "+" : ""}${row.change?.toFixed(2)}` : ""}
                    {row.changePct !== undefined ? ` (${fmtPct(row.changePct)})` : ""}
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="wl-row-menu-btn"
                aria-label="Actions"
                onClick={() => setMenuItem(menuItem?.id === row.id ? null : row)}
              >
                ⋮
              </button>
              {menuItem?.id === row.id && (
                <div className="wl-row-menu">
                  <button type="button" onClick={() => { onOpenChart(row); setMenuItem(null); }}>Chart</button>
                  <button type="button" onClick={() => { onBuy(row); setMenuItem(null); }}>Buy</button>
                  <button type="button" onClick={() => { onSell(row); setMenuItem(null); }}>Sell</button>
                  <button type="button" onClick={() => { setShowMove(row); setMenuItem(null); }}>Move to…</button>
                  <button type="button" className="danger" onClick={() => handleRemove(row)}>Remove</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
              <button type="button" className="wl-modal-cancel" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="button" className="wl-modal-primary" onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showAddPicker && (
        <div className="wl-modal-backdrop" onClick={() => setShowAddPicker(null)}>
          <div className="wl-modal" onClick={e => e.stopPropagation()}>
            <h3>Add to Watchlist</h3>
            <p className="wl-modal-sub">
              {showAddPicker.display} · {showAddPicker.exchange}
            </p>
            <div className="wl-picker-list">
              {lists.map(list => (
                <label key={list.id} className="wl-picker-item">
                  <input
                    type="radio"
                    name="wl-pick"
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
                setShowAddPicker(null);
                setNewListName("");
                setShowCreate(true);
              }}
            >
              + Create New Watchlist
            </button>
            <div className="wl-modal-actions">
              <button type="button" className="wl-modal-cancel" onClick={() => setShowAddPicker(null)}>Cancel</button>
              <button
                type="button"
                className="wl-modal-primary"
                disabled={pickerListId == null}
                onClick={() => {
                  if (pickerListId == null) return;
                  void handleAddToList(pickerListId, showAddPicker).then(() => setShowAddPicker(null));
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showMove && (
        <div className="wl-modal-backdrop" onClick={() => setShowMove(null)}>
          <div className="wl-modal" onClick={e => e.stopPropagation()}>
            <h3>Move to Watchlist</h3>
            <div className="wl-picker-list">
              {lists.filter(l => l.id !== activeId).map(list => (
                <button key={list.id} type="button" className="wl-picker-btn" onClick={() => handleMove(list.id)}>
                  {list.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
