"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FiHeart, FiMessageSquare } from "react-icons/fi";
import { CheckCircle } from "@/components/advisor-ui/icons";
import TradePanel from "@/components/trades/trade-panel";
import FeedFilter, { DEFAULT_FEED_FILTERS, type FeedFilters } from "@/components/feed/feed-filter";
import { formatRelativeTime } from "@/lib/format-date";

type Trade = {
  id: number;
  title: string;
  content: string;
  assetType: string;
  marketSymbol: string | null;
  exchange: string | null;
  sentiment: string;
  riskLevel: string;
  tradeStatus: string | null;
  timeframeType: string | null;
  conviction: number | null;
  entryPriceMin: number | null;
  entryPriceMax: number | null;
  targetPrice: number | null;
  stopLossPrice: number | null;
  potential_return_pct: number | null;
  has_trade: boolean;
  is_locked: boolean;
  unlock_price: number | null;
  post_access_type: "free" | "paid";
  publishedAt: string | null;
  createdAt: string;
  advisor: {
    id: number;
    fullName: string;
    advisorProfile: { sebiRegistrationNo: string | null } | null;
  } | null;
  _count: { reactions: number; comments: number };
};

const ASSET_TABS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "equity", label: "Stocks" },
  { id: "futures", label: "Futures" },
  { id: "options", label: "Options" },
  { id: "commodity", label: "Commodity" },
  { id: "currency", label: "Currency" },
  { id: "crypto", label: "Crypto" },
];

type Quick = "none" | "open" | "target_hit" | "free" | "premium";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function TradesClient({ trades, isAuthed }: { trades: Trade[]; isAuthed: boolean }) {
  const [asset, setAsset] = useState("all");
  const [quick, setQuick] = useState<Quick>("none");
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FEED_FILTERS);

  const visible = useMemo(() => {
    const list = trades.filter((t) => {
      if (asset !== "all" && t.assetType !== asset) return false;
      if (quick === "open" && !(t.tradeStatus === "awaiting_entry" || t.tradeStatus === "active"))
        return false;
      if (quick === "target_hit" && t.tradeStatus !== "target_hit") return false;
      if (quick === "free" && t.post_access_type !== "free") return false;
      if (quick === "premium" && t.post_access_type !== "paid") return false;
      if (filters.sentiment !== "all" && t.sentiment !== filters.sentiment) return false;
      if (filters.risk !== "all" && t.riskLevel !== filters.risk) return false;
      if (filters.access !== "all" && t.post_access_type !== filters.access) return false;
      if (filters.horizon !== "all" && t.timeframeType !== filters.horizon) return false;
      if (filters.status !== "all" && t.tradeStatus !== filters.status) return false;
      return true;
    });
    list.sort((a, b) => {
      const ta = new Date(a.publishedAt ?? a.createdAt).getTime();
      const tb = new Date(b.publishedAt ?? b.createdAt).getTime();
      return filters.sort === "latest" ? tb - ta : ta - tb;
    });
    return list;
  }, [trades, asset, quick, filters]);

  const chip = (id: Quick, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setQuick((q) => (q === id ? "none" : id))}
      className={`trades-chip${quick === id ? " active" : ""}`}
    >
      {label}
    </button>
  );

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: -0.5 }}>
            Trades
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
            Structured BUY / SELL calls from SEBI-registered analysts
          </p>
        </div>
        <FeedFilter value={filters} onChange={setFilters} />
      </div>

      {/* Asset tabs */}
      <div className="trades-tabs">
        {ASSET_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAsset(t.id)}
            className={`trades-tab${asset === t.id ? " active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Quick chips */}
      <div className="trades-chips">
        {chip("open", "Open")}
        {chip("target_hit", "Target Hit")}
        {chip("free", "Free")}
        {chip("premium", "Premium")}
      </div>

      {visible.length === 0 ? (
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          No trades match these filters.
        </article>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {visible.map((t) => (
            <article
              key={t.id}
              style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Link
                  href={`/user/advisors/${t.advisor?.id}`}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                    color: "#0ea5e9",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    flexShrink: 0,
                    textDecoration: "none",
                  }}
                >
                  {initials(t.advisor?.fullName ?? "??")}
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                    {t.advisor?.fullName}
                    <CheckCircle size={13} style={{ color: "#10b981" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    SEBI Registered Analyst · {formatRelativeTime(t.publishedAt ?? t.createdAt)}
                  </div>
                </div>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    background: t.post_access_type === "paid" ? "rgba(124,58,237,0.14)" : "rgba(16,185,129,0.14)",
                    color: t.post_access_type === "paid" ? "#7c3aed" : "#047857",
                  }}
                >
                  {t.post_access_type === "paid" ? "Premium" : "Free"}
                </span>
              </div>

              <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{t.title}</h3>

              <TradePanel
                locked={t.is_locked}
                hasTrade={t.has_trade}
                precomputedReturnPct={t.potential_return_pct}
                unlockPrice={t.unlock_price}
                data={{
                  sentiment: t.sentiment,
                  exchange: t.exchange,
                  marketSymbol: t.marketSymbol,
                  tradeStatus: t.tradeStatus,
                  timeframeType: t.timeframeType,
                  riskLevel: t.riskLevel,
                  conviction: t.conviction,
                  entryPriceMin: t.entryPriceMin,
                  entryPriceMax: t.entryPriceMax,
                  targetPrice: t.targetPrice,
                  stopLossPrice: t.stopLossPrice,
                }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <FiHeart size={14} /> {t._count.reactions}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <FiMessageSquare size={14} /> {t._count.comments}
                </span>
                <span style={{ flex: 1 }} />
                <Link
                  href={`/user/markets/${t.id}`}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 10,
                    background: "#0ea5e9",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {t.is_locked ? "Unlock Trade" : "View Trade"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {!isAuthed && (
        <p style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "var(--text-muted)" }}>
          <Link href="/login" style={{ color: "#0ea5e9", fontWeight: 700 }}>Sign in</Link> to like, comment and unlock premium trades.
        </p>
      )}
    </section>
  );
}
