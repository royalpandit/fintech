"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowUpRight, FiArrowDownRight, FiBarChart2 } from "react-icons/fi";
import MarketSearch from "@/components/trading/market-search";
import MutualFundsView from "@/components/trading/mutual-funds-view";
import CryptoView from "@/components/trading/crypto-view";
import CurrenciesView from "@/components/trading/currencies-view";
import MarketsAllView from "@/components/trading/markets-all-view";
import MarketsPlaceholder from "@/components/trading/markets-placeholder";
import GlobalMarketsView from "@/components/trading/global-markets-view";
import IpoView from "@/components/trading/ipo-view";
import EtfView from "@/components/trading/etf-view";
import AddToWatchlistButton from "@/components/watchlist/add-to-watchlist-button";
import TradeButtons from "@/components/trading/trade-buttons";
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
      <div className="mkt-head">
        <div>
          <h1 className="mkt-title">Markets</h1>
          <p className="mkt-sub">
            Live indices, top movers and 52-week levels
            {/* A pill with a pulsing dot, not a bare timestamp next to a static
                refresh glyph — it reads as "this is live" at a glance. */}
            {updatedAt && (
              <span className="mkt-live" title={`Quotes refresh every 10s · last ${updatedAt}`}>
                <span className="mkt-live-dot" aria-hidden />
                Live · {updatedAt}
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
      {/* A segmented control rather than an underline rail: nine tabs on an
          underline read as a wall of grey text, and on a narrow screen the row
          scrolls with no sign that it does. */}
      <div className="mkt-tabs" role="tablist" aria-label="Instrument type">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`mkt-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "all" && <MarketsAllView stocks={stocks} indices={indices} loading={loading} />}
      {tab === "mf" && <MutualFundsView />}
      {tab === "crypto" && <CryptoView />}
      {tab === "currencies" && <CurrenciesView />}
      {tab === "etf" && <EtfView />}
      {tab === "commodities" && (
        <MarketsPlaceholder
          title="Commodities"
          blurb="MCX commodities (gold, silver, crude, natural gas). Requires the broker's commodity (MCX) segment to be enabled on the data feed — that's an account setting, not a missing API."
          needs="MCX data segment on Demat"
        />
      )}
      {tab === "ipo" && <IpoView />}
      {tab === "global" && <GlobalMarketsView />}

      {tab === "stocks" && (
      <>
      {/* Sector / industry filter */}
      <div className="mkt-chips">
        {[{ key: "all", label: "All sectors" }, ...MARKET_SECTORS].map((s) => (
          <button
            key={s.key}
            type="button"
            className={`mkt-chip${sector === s.key ? " is-active" : ""}`}
            onClick={() => setSector(s.key)}
          >
            {s.label}
          </button>
        ))}
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

      {/* Index cards.

          While loading these used to render three fake rows of zeroes — "—"
          and a flat "+0.00%" — which is not a loading state, it is wrong data
          wearing a real card. With the new coloured direction rail it also
          painted three green edges for a change nobody had measured yet. */}
      <div className="mkt-index-grid">
        {loading && indices.length === 0
          ? Array.from({ length: 3 }, (_, i) => <IndexCardSkeleton key={i} />)
          : indices.map((idx) => {
              const pos = idx.percentChange >= 0;
              return (
                <Link
                  key={idx.token}
                  href={chartHref(idx)}
                  /* data-dir drives a coloured hairline down the left edge, so
                     the direction of a whole row of indices reads before any
                     number does. */
                  className="mkt-index-card"
                  data-dir={pos ? "up" : "down"}
                >
                  <div className="mkt-index-sym">{idx.symbol || "—"}</div>
                  <div className="mkt-index-ltp">{idx.ltp ? inr(idx.ltp) : "—"}</div>
                  <div className={`mkt-chg ${pos ? "up" : "down"}`}>
                    {pos ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
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
              <tr style={{ color: "var(--text-muted)", fontSize: 11 }}>
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
              <span
                style={{
                  paddingRight: 12,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <TradeButtons symbol={r.symbol} instrumentType={r.type} exchange={r.exchange} price={r.ltp} />
                <AddToWatchlistButton item={toWatchItem(r)} compact label="" />
              </span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

// globals.css has `th, td { text-align: left }` — a real declaration, so it
// beats text-align inherited from <tr> and every numeric header sat left of its
// right-aligned values. Default to right here, matching Td; callers that want a
// left-aligned header (Symbol) override via `style`.
function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: "10px 16px", fontWeight: 600, textAlign: "right", ...style }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "11px 16px", textAlign: "right", ...style }}>{children}</td>;
}

/**
 * An index card that is visibly loading.
 *
 * Replaces skeletonRows(), which built fake OverviewRow objects full of zeroes
 * and fed them through the real card — so the loading state was three cards
 * reading "—" and "+0.00%", indistinguishable from a genuinely flat market.
 * Shimmer bars say "not yet"; a zero says "measured, and it is zero".
 */
function IndexCardSkeleton() {
  return (
    <div className="mkt-index-card mkt-index-card--skel" aria-hidden>
      <span className="skel" style={{ width: 74, height: 11, borderRadius: 6 }} />
      <span className="skel" style={{ width: 122, height: 25, borderRadius: 8, margin: "8px 0 8px" }} />
      <span className="skel" style={{ width: 96, height: 18, borderRadius: 7 }} />
    </div>
  );
}
