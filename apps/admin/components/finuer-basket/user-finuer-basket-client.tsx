"use client";

import { useEffect, useMemo, useState } from "react";
import FinuerBasketCard, { type FinuerBasketCardData } from "@/components/finuer-basket/finuer-basket-card";
import type { FinuerBasketTimePeriod } from "@/lib/finuer-basket";
import {
  UserPageHeader,
  UserPageSection,
  UserPageStatCard,
  UserPageStatsGrid,
} from "@/components/user/user-page-layout";

type Market = { id: number; name: string };
type BasketType = { id: number; name: string };

export default function UserFinuerBasketClient() {
  const [baskets, setBaskets] = useState<FinuerBasketCardData[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [types, setTypes] = useState<BasketType[]>([]);
  const [marketId, setMarketId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [timePeriod, setTimePeriod] = useState<FinuerBasketTimePeriod>("1_year");
  const [sortOrder, setSortOrder] = useState("");
  const [access, setAccess] = useState<"" | "free" | "premium">("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  /**
   * Two things were wrong here and both looked like "search is broken".
   *
   * 1. No try/catch. `setLoading(false)` sat after the awaits, so any throw —
   *    a non-JSON error body, a dropped connection — skipped it and left the
   *    page shimmering forever with "—" in every stat card, while the throw
   *    surfaced as an unhandled rejection in the dev overlay.
   * 2. No guard against out-of-order responses. Typing runs a request per
   *    debounced keystroke, and a slow earlier one could resolve after a later
   *    one and overwrite the newer results with stale rows.
   *
   * AbortController fixes the race at the source (the superseded request is
   * cancelled, not just ignored) and try/finally guarantees the spinner clears.
   */
  useEffect(() => {
    const ctrl = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (marketId) params.set("market_id", marketId);
        if (typeId) params.set("type_id", typeId);
        if (timePeriod) params.set("time_period", timePeriod);
        if (sortOrder) params.set("sort_order", sortOrder);
        if (search) params.set("search", search);

        const r = await fetch(`/api/v1/baskets?${params}`, { signal: ctrl.signal });
        const j = await r.json();
        if (ctrl.signal.aborted) return;

        if (j.ok) {
          setBaskets(j.data ?? []);
          if (j.meta?.markets) setMarkets(j.meta.markets);
          if (j.meta?.types) setTypes(j.meta.types);
          setLoadError("");
        } else {
          setBaskets([]);
          setLoadError(j.error || "Could not load baskets.");
        }
      } catch (err) {
        // An abort is this effect superseding itself, not a failure — and the
        // newer run owns the loading state from here.
        if (ctrl.signal.aborted || (err as Error)?.name === "AbortError") return;
        setBaskets([]);
        setLoadError(err instanceof Error ? err.message : "Could not load baskets.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => ctrl.abort();
  }, [marketId, typeId, timePeriod, sortOrder, search]);

  const visibleBaskets = useMemo(() => {
    if (!access) return baskets;
    return baskets.filter((b) =>
      access === "premium" ? b.requiredPlan === "premium" : b.requiredPlan !== "premium",
    );
  }, [baskets, access]);

  const stats = useMemo(() => {
    const outperforming = visibleBaskets.filter((b) => b.performance.performanceStatus === "outperforming").length;
    const returns = baskets
      .map((b) => b.performance.basketReturn)
      .filter((v): v is number => v != null);
    const avg =
      returns.length > 0 ? returns.reduce((s, v) => s + v, 0) / returns.length : null;
    return { outperforming, avg };
  }, [visibleBaskets]);

  return (
    <UserPageSection>
      <UserPageHeader
        title="Finuer Basket"
        subtitle="Curated model portfolios — returns are calculated automatically from holdings vs benchmark."
      />

      {/* One grid, not two flex rows. As flex rows each control sized to its own
          content, so the five selects came out five different widths and their
          labels stepped along at five different x-positions. A grid gives every
          field an identical column and puts the labels on a single rhythm. */}
      <div className="fb-filters">
        <div className="fb-filter fb-filter--search">
          <span className="finuer-basket-filter-label">Search</span>
          <input
            className="finuer-basket-filter-select"
            style={{ width: "100%" }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Basket name, market, type, or stock…"
          />
        </div>

        <div className="fb-filter">
          <span className="finuer-basket-filter-label">Market</span>
          <select
            className="finuer-basket-filter-select"
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
          >
            <option value="">All Markets</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fb-filter">
          <span className="finuer-basket-filter-label">Type</span>
          <select
            className="finuer-basket-filter-select"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
          >
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fb-filter">
          <span className="finuer-basket-filter-label">Access</span>
          <select
            className="finuer-basket-filter-select"
            value={access}
            onChange={(e) => setAccess(e.target.value as "" | "free" | "premium")}
          >
            <option value="">All Baskets</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div className="fb-filter">
          <span className="finuer-basket-filter-label">Performance</span>
          <select
            className="finuer-basket-filter-select"
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value as FinuerBasketTimePeriod)}
          >
            <option value="1_month">1 Month</option>
            <option value="3_months">3 Months</option>
            <option value="6_months">6 Months</option>
            <option value="1_year">1 Year</option>
            <option value="3_years">3 Years</option>
            <option value="5_years">5 Years</option>
            <option value="since_launch">Since Launch</option>
          </select>
        </div>
        <div className="fb-filter">
          <span className="finuer-basket-filter-label">Sort By</span>
          <select
            className="finuer-basket-filter-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="">Default</option>
            <option value="highest_return">Highest Return</option>
            <option value="lowest_return">Lowest Return</option>
          </select>
        </div>
      </div>

      {/* Stat cards go after the search bar and filters. */}
      <UserPageStatsGrid>
        <UserPageStatCard label="Active Baskets" value={loading ? "—" : String(visibleBaskets.length)} color="#0ea5e9" />
        <UserPageStatCard
          label="Outperforming"
          value={loading ? "—" : String(stats.outperforming)}
          color="#22c55e"
        />
        <UserPageStatCard
          label="Avg Return"
          value={
            loading || stats.avg == null
              ? "—"
              : `${stats.avg >= 0 ? "+" : ""}${stats.avg.toFixed(2)}%`
          }
          color="#8b5cf6"
        />
        <UserPageStatCard label="Markets" value={loading ? "—" : String(markets.length)} color="#f59e0b" />
      </UserPageStatsGrid>

      {loading ? (
        <div className="finuer-basket-page-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skel" style={{ height: 300, borderRadius: 16 }} />
          ))}
        </div>
      ) : loadError ? (
        /* A failed load is not an empty result. Saying "no baskets match your
           filters" when the request never succeeded sends people off adjusting
           filters that were never the problem. */
        <div className="user-page-empty">
          <p style={{ margin: 0, fontWeight: 600 }}>Could not load baskets.</p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{loadError}</p>
        </div>
      ) : visibleBaskets.length === 0 ? (
        <div className="user-page-empty">
          <p style={{ margin: 0 }}>No baskets match your filters. Try adjusting search or filters.</p>
        </div>
      ) : (
        <div className="finuer-basket-page-grid">
          {visibleBaskets.map((basket) => (
            <FinuerBasketCard key={basket.id} basket={basket} timePeriod={timePeriod} />
          ))}
        </div>
      )}
    </UserPageSection>
  );
}
