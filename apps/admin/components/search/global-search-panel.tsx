"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SEARCH_CATEGORY_LABELS,
  SEARCH_CATEGORY_ORDER,
  TRENDING_STOCKS,
  chartHref,
  groupMarketHits,
  normalizeMarketSearchRow,
  type MarketSearchHit,
  type SearchCategory,
} from "@/lib/search-categories";

type Props = {
  query: string;
  anchorRef: RefObject<HTMLElement | null>;
  onNavigate?: () => void;
};

type PanelCoords = {
  top: number;
  left: number;
  width: number;
};

export default function GlobalSearchPanel({ query, anchorRef, onNavigate }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<PanelCoords>({ top: 0, left: 0, width: 320 });
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<MarketSearchHit[]>([]);
  const [activeTab, setActiveTab] = useState<SearchCategory | "all">("all");

  const trimmed = query.trim();
  const isEmpty = trimmed.length === 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    function updatePosition() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 280),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, trimmed, loading, hits.length]);

  useEffect(() => {
    setActiveTab("all");
  }, [trimmed]);

  useEffect(() => {
    if (!trimmed) {
      setHits([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/market/search?q=${encodeURIComponent(trimmed)}&exchange=ALL`,
          { cache: "no-store" },
        );
        const json = await res.json();
        const rows = (json.data ?? []).map(normalizeMarketSearchRow);
        setHits(rows.slice(0, 40));
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const grouped = useMemo(() => groupMarketHits(hits), [hits]);

  const visibleCategories = useMemo(() => {
    if (isEmpty) return [] as SearchCategory[];
    if (activeTab === "all") {
      return SEARCH_CATEGORY_ORDER.filter((c) => grouped[c].length > 0);
    }
    return grouped[activeTab].length > 0 ? [activeTab] : [];
  }, [isEmpty, activeTab, grouped]);

  function goTo(hit: MarketSearchHit) {
    onNavigate?.();
    router.push(chartHref(hit));
  }

  function renderRow(hit: MarketSearchHit) {
    return (
      <button
        key={`${hit.exchange}-${hit.token}`}
        type="button"
        className="us-search-result-row"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => goTo(hit)}
      >
        <div className="us-search-result-main">
          <span className="us-search-result-title">{hit.display}</span>
          <span className="us-search-result-sub">{hit.tradingSymbol}</span>
        </div>
        <span className="us-search-result-exch">{hit.exchange}</span>
      </button>
    );
  }

  const panel = (
    <div
      className="us-global-search-panel us-global-search-panel--fixed"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
      role="listbox"
      aria-label="Search results"
    >
      {isEmpty ? (
        <div className="us-search-panel-section">
          <div className="us-search-panel-section-head">
            <span className="us-search-panel-section-title">Trending Stocks</span>
          </div>
          <div className="us-search-panel-list">
            {TRENDING_STOCKS.map((hit) => renderRow(hit))}
          </div>
        </div>
      ) : (
        <>
          <div className="us-search-category-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={`us-search-category-tab${activeTab === "all" ? " active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            {SEARCH_CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                className={`us-search-category-tab${activeTab === cat ? " active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setActiveTab(cat)}
              >
                {SEARCH_CATEGORY_LABELS[cat]}
                {grouped[cat].length > 0 ? ` (${grouped[cat].length})` : ""}
              </button>
            ))}
          </div>

          {loading && <p className="us-search-panel-muted">Searching…</p>}

          {!loading && visibleCategories.length === 0 && (
            <p className="us-search-panel-muted">No results for &quot;{trimmed}&quot;.</p>
          )}

          {!loading &&
            activeTab === "all" &&
            visibleCategories.map((cat) => (
              <div key={cat} className="us-search-panel-section">
                <div className="us-search-panel-section-head">
                  <span className="us-search-panel-section-title">
                    {SEARCH_CATEGORY_LABELS[cat]}
                  </span>
                  <span className="us-search-panel-section-count">{grouped[cat].length}</span>
                </div>
                <div className="us-search-panel-list">
                  {grouped[cat].slice(0, 6).map((hit) => renderRow(hit))}
                </div>
              </div>
            ))}

          {!loading && activeTab !== "all" && grouped[activeTab].length > 0 && (
            <div className="us-search-panel-section">
              <div className="us-search-panel-list">
                {grouped[activeTab].map((hit) => renderRow(hit))}
              </div>
            </div>
          )}

          {!loading && hits.length > 0 && (
            <div className="us-search-panel-footer">
              <Link
                href={`/user/search?q=${encodeURIComponent(trimmed)}`}
                className="us-search-panel-more"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onNavigate}
              >
                Search advisors &amp; courses for &quot;{trimmed}&quot; →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
