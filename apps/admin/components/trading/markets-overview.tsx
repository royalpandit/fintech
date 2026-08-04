"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowUpRight, FiArrowDownRight, FiBarChart2, FiRefreshCw } from "react-icons/fi";
import MarketSearch from "@/components/trading/market-search";
import MutualFundsView from "@/components/trading/mutual-funds-view";
import CryptoView from "@/components/trading/crypto-view";
import CurrenciesView from "@/components/trading/currencies-view";
import MarketsAllView from "@/components/trading/markets-all-view";
import MarketsPlaceholder from "@/components/trading/markets-placeholder";
import AddToWatchlistButton from "@/components/watchlist/add-to-watchlist-button";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";
import { MARKET_SECTORS, stockInSector } from "@/lib/market-sectors";

type OverviewRow = {
  symbol: string;
  token: string;
  exchange: string;
  type: "INDEX" | "EQ";
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  netChange: number;
  percentChange: number;
  week52High: number | null;
  week52Low: number | null;
};

const inr = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function chartHref(r: OverviewRow) {
  const params = new URLSearchParams({
    symbol: r.symbol,
    token: r.token,
    exchange: r.exchange,
    type: r.type,
  });
  return `/user/markets/chart?${params.toString()}`;
}

function toWatchItem(r: OverviewRow): WatchlistItem {
  return { display: r.symbol, tradingSymbol: r.symbol, token: r.token, exchange: r.exchange, type: r.type };
}

const up = "#16a34a";
const down = "#dc2626";

type MarketTab =
  | "all"
  | "stocks"
  | "mf"
  | "etf"
  | "commodities"
  | "ipo"
  | "crypto"
  | "currencies"
  | "global";

const TABS: { key: MarketTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "stocks", label: "Stocks & Indices" },
  { key: "mf", label: "Mutual Funds" },
  { key: "etf", label: "ETFs" },
  { key: "commodities", label: "Commodities" },
  { key: "ipo", label: "IPO" },
  { key: "crypto", label: "Crypto" },
  { key: "currencies", label: "Currencies" },
  { key: "global", label: "Global" },
];

export default function MarketsOverview() {
  const [tab, setTab] = useState<MarketTab>("all");
  const [sector, setSector] = useState<string>("all");
  const [indices, setIndices] = useState<OverviewRow[]>([]);
  const [stocks, setStocks] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const needsStockData = tab === "all" || tab === "stocks";

  useEffect(() => {
    if (!needsStockData) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/market/overview", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (json.ok) {
          setIndices(json.indices ?? []);
          setStocks(json.stocks ?? []);
          setError("");
          setUpdatedAt(new Date().toLocaleTimeString("en-IN"));
        } else if (json.rateLimited) {
          setError("Live quotes paused (rate limit). Retrying…");
        } else {
          setError(json.error || "Failed to load market data");
        }
      } catch {
        if (alive) setError("Network error");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [needsStockData]);

  const filteredStocks = useMemo(
    () => (sector === "all" ? stocks : stocks.filter((s) => stockInSector(s.symbol, sector))),
    [stocks, sector],
  );

  const gainers = useMemo(
    () => [...stocks].sort((a, b) => b.percentChange - a.percentChange).slice(0, 5),
    [stocks],
  );
  const losers = useMemo(
    () => [...stocks].sort((a, b) => a.percentChange - b.percentChange).slice(0, 5),
    [stocks],
  );

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: -0.5 }}>
            Markets
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
            Live indices, top movers and 52-week levels
            {updatedAt && (
              <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <FiRefreshCw size={10} /> {updatedAt}
              </span>
            )}
          </p>
        </div>
        {tab === "stocks" && (
          <Link
            href="/user/markets/chart"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: 10,
              background: "var(--accent-blue, #2563eb)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <FiBarChart2 size={15} /> Open full chart
          </Link>
        )}
      </div>

      {/* Instrument tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                whiteSpace: "nowrap",
                color: active ? "var(--text)" : "var(--text-muted)",
                borderBottom: active ? "2px solid var(--primary, #10b981)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "all" && <MarketsAllView stocks={stocks} />}
      {tab === "mf" && <MutualFundsView />}
      {tab === "crypto" && <CryptoView />}
      {tab === "currencies" && <CurrenciesView />}
      {tab === "etf" && (
        <MarketsPlaceholder
          title="ETFs"
          blurb="Exchange-traded funds trade like stocks. Use the Stocks tab search for listed ETFs (e.g. NIFTYBEES, GOLDBEES) — a dedicated curated ETF board is coming next."
          needs="curated ETF list"
        />
      )}
      {tab === "commodities" && (
        <MarketsPlaceholder
          title="Commodities"
          blurb="MCX commodities (gold, silver, crude, natural gas). Requires the broker's commodity (MCX) segment to be enabled on the data feed."
          needs="MCX data segment"
        />
      )}
      {tab === "ipo" && (
        <MarketsPlaceholder
          title="IPO"
          blurb="Upcoming, open and recently-listed IPOs. There's no free feed for this — it needs a paid IPO data provider or an admin-curated list."
          needs="IPO data provider / admin-curated list"
        />
      )}
      {tab === "global" && (
        <MarketsPlaceholder
          title="Global Markets"
          blurb="US & global indices (S&P 500, Nasdaq, Dow, FTSE, Nikkei) and ADRs. Needs a global market-data provider."
          needs="global market-data provider"
        />
      )}

      {tab === "stocks" && (
      <>
      {/* Sector / industry filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {[{ key: "all", label: "All sectors" }, ...MARKET_SECTORS].map((s) => {
          const active = sector === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSector(s.key)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid var(--border)",
                background: active ? "var(--primary-soft, rgba(37,99,235,0.12))" : "var(--surface)",
                color: active ? "var(--accent-blue, #2563eb)" : "var(--text-muted)",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <MarketSearch />

      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.3)",
            color: "#92400e",
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Index cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {(loading && indices.length === 0 ? skeletonRows(3) : indices).map((idx, i) => {
          const pos = idx.percentChange >= 0;
          return (
            <Link
              key={idx.token || i}
              href={idx.token ? chartHref(idx) : "#"}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 6 }}>
                {idx.symbol || "—"}
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text)", letterSpacing: -0.5 }}>
                {idx.ltp ? inr(idx.ltp) : "—"}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: pos ? up : down,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                {pos ? <FiArrowUpRight size={14} /> : <FiArrowDownRight size={14} />}
                {idx.netChange >= 0 ? "+" : ""}
                {inr(idx.netChange)} ({idx.percentChange >= 0 ? "+" : ""}
                {idx.percentChange.toFixed(2)}%)
              </div>
            </Link>
          );
        })}
      </div>

      {/* Gainers + Losers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <MoverList title="Top Gainers" rows={gainers} positive />
        <MoverList title="Top Losers" rows={losers} positive={false} />
      </div>

      {/* All stocks table with 52-week levels */}
      <article
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            {sector === "all" ? "All Stocks" : `${MARKET_SECTORS.find((s) => s.key === sector)?.label ?? ""} Stocks`} · 52-Week Range
          </h3>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{filteredStocks.length} shown</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "right" }}>
                <Th style={{ textAlign: "left" }}>Symbol</Th>
                <Th>LTP</Th>
                <Th>Change</Th>
                <Th>%</Th>
                <Th>52W High</Th>
                <Th>52W Low</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((s) => {
                const pos = s.percentChange >= 0;
                return (
                  <tr
                    key={s.token}
                    className="mkt-trow"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <Td style={{ textAlign: "left" }}>
                      <Link
                        href={chartHref(s)}
                        style={{ color: "var(--text)", fontWeight: 600, textDecoration: "none" }}
                      >
                        {s.symbol}
                      </Link>
                    </Td>
                    <Td style={{ fontWeight: 600, color: "var(--text)" }}>{inr(s.ltp)}</Td>
                    <Td style={{ color: pos ? up : down }}>
                      {s.netChange >= 0 ? "+" : ""}
                      {inr(s.netChange)}
                    </Td>
                    <Td style={{ color: pos ? up : down, fontWeight: 600 }}>
                      {s.percentChange >= 0 ? "+" : ""}
                      {s.percentChange.toFixed(2)}%
                    </Td>
                    <Td style={{ color: "var(--text-muted)" }}>
                      {s.week52High != null ? inr(s.week52High) : "—"}
                    </Td>
                    <Td style={{ color: "var(--text-muted)" }}>
                      {s.week52Low != null ? inr(s.week52Low) : "—"}
                    </Td>
                    <Td>
                      <AddToWatchlistButton item={toWatchItem(s)} compact label="" />
                    </Td>
                  </tr>
                );
              })}
              {filteredStocks.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}
                  >
                    {loading
                      ? "Loading market data…"
                      : sector !== "all" && stocks.length > 0
                        ? "No stocks from this sector in the current live list."
                        : "No data available."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      </>
      )}
    </section>
  );
}

function MoverList({ title, rows, positive }: { title: string; rows: OverviewRow[]; positive: boolean }) {
  const color = positive ? up : down;
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {positive ? <FiArrowUpRight size={15} color={color} /> : <FiArrowDownRight size={15} color={color} />}
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{title}</h3>
      </div>
      <div>
        {rows.length === 0 ? (
          <p style={{ margin: 0, padding: 18, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
            —
          </p>
        ) : (
          rows.map((r) => (
            <div
              key={r.token}
              className="mkt-row"
              style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid var(--border)" }}
            >
              <Link
                href={chartHref(r)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 4px 11px 16px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text)", fontSize: 13 }}>{r.symbol}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "var(--text)", fontSize: 13 }}>{inr(r.ltp)}</span>
                  <span style={{ color, fontWeight: 600, fontSize: 13, minWidth: 64, textAlign: "right" }}>
                    {r.percentChange >= 0 ? "+" : ""}
                    {r.percentChange.toFixed(2)}%
                  </span>
                </span>
              </Link>
              <span style={{ paddingRight: 12, flexShrink: 0 }}>
                <AddToWatchlistButton item={toWatchItem(r)} compact label="" />
              </span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: "10px 16px", fontWeight: 600, ...style }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "11px 16px", textAlign: "right", ...style }}>{children}</td>;
}

function skeletonRows(n: number): OverviewRow[] {
  return Array.from({ length: n }, () => ({
    symbol: "",
    token: "",
    exchange: "",
    type: "INDEX" as const,
    ltp: 0,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    netChange: 0,
    percentChange: 0,
    week52High: null,
    week52Low: null,
  }));
}
