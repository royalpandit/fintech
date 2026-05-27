"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALL_CHART_TYPES,
  ALL_TIMEFRAMES,
  CHART_TYPE_GROUPS,
  FAVORITE_CHART_TYPES_KEY,
  FAVORITE_INDICATORS_KEY,
  FAVORITE_TIMEFRAMES_KEY,
  INDICATOR_CATALOG,
  TIMEFRAME_GROUPS,
  type ChartTypeOption,
  type IndicatorDefinition,
  type TimeframeOption,
} from "./chart-config";
import type { ChartType } from "./chart-widget";
import type { CustomIndicator } from "./chart-widget";

function loadFavs(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavs(key: string, ids: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

function StarBtn({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button type="button" className={`tv-star ${active ? "on" : ""}`} onClick={onClick} aria-label="Favorite">
      ★
    </button>
  );
}

// ── Timeframe dropdown ────────────────────────────────────────────────────────

export function TimeframeMenu({
  value,
  onChange,
  open,
  onClose,
}: {
  value: TimeframeOption;
  onChange: (tf: TimeframeOption) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [favs, setFavs] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFavs(loadFavs(FAVORITE_TIMEFRAMES_KEY));
  }, [open]);

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavs(FAVORITE_TIMEFRAMES_KEY, next);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="tv-menu tv-menu-timeframe" role="listbox">
      {TIMEFRAME_GROUPS.map(group => {
        const isCollapsed = collapsed[group.section];
        return (
          <div key={group.section} className="tv-menu-section">
            <button
              type="button"
              className="tv-menu-section-head"
              onClick={() => setCollapsed(c => ({ ...c, [group.section]: !c[group.section] }))}
            >
              <span>{group.section}</span>
              <span className="tv-chevron">{isCollapsed ? "▼" : "▲"}</span>
            </button>
            {!isCollapsed && group.items.map(tf => (
              <button
                key={tf.id}
                type="button"
                className={`tv-menu-item ${value.id === tf.id ? "active" : ""}`}
                onClick={() => { onChange(tf); onClose(); }}
              >
                <span>{tf.label}</span>
                {tf.hint && <span className="tv-hint">{tf.hint}</span>}
                <StarBtn active={favs.has(tf.id) || !!tf.favorite} onClick={e => toggleFav(tf.id, e)} />
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Chart type dropdown ───────────────────────────────────────────────────────

export function ChartTypeMenu({
  value,
  onChange,
  open,
  onClose,
}: {
  value: ChartType;
  onChange: (id: ChartType) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [favs, setFavs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (open) setFavs(loadFavs(FAVORITE_CHART_TYPES_KEY));
  }, [open]);

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavs(FAVORITE_CHART_TYPES_KEY, next);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="tv-menu tv-menu-charttype" role="listbox">
      {CHART_TYPE_GROUPS.map(group => (
        <div key={group.section}>
          {group.items.length > 0 && group.section !== "BARS" && (
            <div className="tv-menu-divider" />
          )}
          {group.items.map(ct => (
            <button
              key={ct.id}
              type="button"
              className={`tv-menu-item ${value === ct.id ? "active" : ""}`}
              onClick={() => { onChange(ct.id); onClose(); }}
            >
              <ChartTypeIcon id={ct.id} />
              <span>{ct.label}</span>
              <StarBtn active={favs.has(ct.id) || !!ct.favorite} onClick={e => toggleFav(ct.id, e)} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function ChartTypeIcon({ id }: { id: ChartType }) {
  const stroke = "currentColor";
  const s = 14;
  switch (id) {
    case "bar":
      return <svg width={s} height={s} viewBox="0 0 14 14" stroke={stroke} strokeWidth="1.5" fill="none"><line x1="3" y1="1" x2="3" y2="13"/><line x1="1" y1="5" x2="3" y2="5"/><line x1="10" y1="2" x2="10" y2="14"/><line x1="8" y1="6" x2="10" y2="6"/></svg>;
    case "hollow":
    case "candle":
      return <svg width={s} height={s} viewBox="0 0 14 14" stroke={stroke} strokeWidth="1.5" fill="none"><rect x="2" y="4" width="3" height="5"/><line x1="3.5" y1="1" x2="3.5" y2="4"/><rect x="9" y="5" width="3" height="4" fill={id === "candle" ? stroke : "none"}/></svg>;
    case "line":
    case "line-markers":
    case "step":
      return <svg width={s} height={s} viewBox="0 0 14 14" stroke={stroke} strokeWidth="1.5" fill="none"><polyline points={id === "step" ? "1,11 4,11 4,6 7,6 7,8 13,3" : "1,11 4,6 7,8 10,3 13,5"}/></svg>;
    case "area":
    case "baseline":
      return <svg width={s} height={s} viewBox="0 0 14 14" stroke={stroke} strokeWidth="1.2" fill="rgba(14,165,233,0.2)"><path d="M1 10 L4 6 L7 8 L10 4 L13 6 L13 13 L1 13 Z"/></svg>;
    default:
      return <svg width={s} height={s} viewBox="0 0 14 14" stroke={stroke} strokeWidth="1.5" fill="none"><rect x="3" y="3" width="8" height="8" rx="1"/></svg>;
  }
}

export function chartTypeLabel(id: ChartType): string {
  return ALL_CHART_TYPES.find(c => c.id === id)?.label ?? "Candles";
}

export function timeframeLabel(tf: TimeframeOption): string {
  if (tf.id === "1m") return "1m";
  if (tf.id === "5m") return "5m";
  if (tf.id === "1h") return "1h";
  if (tf.id.endsWith("m")) return tf.id;
  if (tf.id.endsWith("h")) return tf.id;
  return tf.label.split(" ")[0];
}

// ── Indicators modal ──────────────────────────────────────────────────────────

export function IndicatorsModal({
  open,
  onClose,
  activeIds,
  onToggle,
  onAddCustom,
}: {
  open: boolean;
  onClose: () => void;
  activeIds: Set<string>;
  onToggle: (def: IndicatorDefinition) => void;
  onAddCustom: () => void;
}) {
  const [query, setQuery] = useState("");
  const [favs, setFavs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (open) {
      setQuery("");
      setFavs(loadFavs(FAVORITE_INDICATORS_KEY));
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDICATOR_CATALOG;
    return INDICATOR_CATALOG.filter(i => i.name.toLowerCase().includes(q));
  }, [query]);

  const popular = filtered.filter(i => i.category === "POPULAR");
  const other = filtered.filter(i => i.category === "OTHER");

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavs(FAVORITE_INDICATORS_KEY, next);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="tv-modal-backdrop" onClick={onClose} role="presentation">
      <div className="tv-ind-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Indicators">
        <div className="tv-ind-head">
          <h3>Indicators</h3>
          <button type="button" className="tv-ind-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="tv-ind-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="tv-ind-search"
            placeholder="Search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="tv-ind-list">
          {popular.length > 0 && (
            <>
              <div className="tv-ind-cat">POPULAR INDICATORS</div>
              {popular.map(ind => (
                <IndicatorRow
                  key={ind.id}
                  ind={ind}
                  active={activeIds.has(ind.id)}
                  fav={favs.has(ind.id) || !!ind.favorite}
                  onFav={e => toggleFav(ind.id, e)}
                  onClick={() => onToggle(ind)}
                />
              ))}
            </>
          )}
          {other.length > 0 && (
            <>
              <div className="tv-ind-cat">OTHER INDICATORS</div>
              {other.map(ind => (
                <IndicatorRow
                  key={ind.id}
                  ind={ind}
                  active={activeIds.has(ind.id)}
                  fav={favs.has(ind.id) || !!ind.favorite}
                  onFav={e => toggleFav(ind.id, e)}
                  onClick={() => onToggle(ind)}
                />
              ))}
            </>
          )}
          {filtered.length === 0 && (
            <p className="tv-ind-empty">No indicators match your search.</p>
          )}
        </div>
        <button type="button" className="tv-ind-custom" onClick={() => { onAddCustom(); onClose(); }}>
          + Add Custom Indicator
        </button>
      </div>
    </div>
  );
}

function IndicatorRow({
  ind,
  active,
  fav,
  onFav,
  onClick,
}: {
  ind: IndicatorDefinition;
  active: boolean;
  fav: boolean;
  onFav: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`tv-ind-row ${active ? "active" : ""}`} onClick={onClick}>
      {fav && <span className="tv-ind-star">★</span>}
      <span className="tv-ind-name">{ind.name}</span>
      {ind.badge && <span className="tv-ind-badge">{ind.badge}</span>}
      {active && <span className="tv-ind-check">✓</span>}
      <StarBtn active={fav} onClick={onFav} />
    </button>
  );
}

export function indicatorToCustom(def: IndicatorDefinition): CustomIndicator {
  return {
    id: def.id,
    name: def.name,
    formula: def.formula,
    color: def.color,
    lineWidth: def.lineWidth ?? 2,
    lineStyle: 0,
    kind: def.kind,
  };
}
