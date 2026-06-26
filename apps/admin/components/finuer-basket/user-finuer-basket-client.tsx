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
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (marketId) params.set("market_id", marketId);
      if (typeId) params.set("type_id", typeId);
      if (timePeriod) params.set("time_period", timePeriod);
      if (sortOrder) params.set("sort_order", sortOrder);
      if (search) params.set("search", search);
      const r = await fetch(`/api/v1/baskets?${params}`);
      const j = await r.json();
      if (j.ok) {
        setBaskets(j.data);
        if (j.meta?.markets) setMarkets(j.meta.markets);
        if (j.meta?.types) setTypes(j.meta.types);
      }
      setLoading(false);
    }
    load();
  }, [marketId, typeId, timePeriod, sortOrder, search]);

  const stats = useMemo(() => {
    const outperforming = baskets.filter((b) => b.performance.performanceStatus === "outperforming").length;
    const returns = baskets
      .map((b) => b.performance.basketReturn)
      .filter((v): v is number => v != null);
    const avg =
      returns.length > 0 ? returns.reduce((s, v) => s + v, 0) / returns.length : null;
    return { outperforming, avg };
  }, [baskets]);

  return (
    <UserPageSection>
      <UserPageHeader
        title="Finuer Basket"
        subtitle="Curated model portfolios — returns are calculated automatically from holdings vs benchmark."
      />

      <UserPageStatsGrid>
        <UserPageStatCard label="Active Baskets" value={loading ? "—" : String(baskets.length)} color="#0ea5e9" />
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

      <div className="finuer-basket-filters-bar" style={{ marginBottom: 12 }}>
        <div className="finuer-basket-filter-field" style={{ flex: "1 1 220px" }}>
          <span className="finuer-basket-filter-label">Search</span>
          <input
            className="finuer-basket-filter-select"
            style={{ width: "100%" }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Basket name, market, type, or stock…"
          />
        </div>
      </div>

      <div className="finuer-basket-filters-bar">
        <div className="finuer-basket-filter-field">
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
        <div className="finuer-basket-filter-field">
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
        <div className="finuer-basket-filter-field">
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
        <div className="finuer-basket-filter-field">
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

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading baskets…</p>
      ) : baskets.length === 0 ? (
        <div className="user-page-empty">
          <p style={{ margin: 0 }}>No baskets match your filters. Try adjusting search or filters.</p>
        </div>
      ) : (
        <div className="finuer-basket-page-grid">
          {baskets.map((basket) => (
            <FinuerBasketCard key={basket.id} basket={basket} timePeriod={timePeriod} />
          ))}
        </div>
      )}
    </UserPageSection>
  );
}
