"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FiHeart, FiMessageSquare, FiStar } from "react-icons/fi";
import { CheckCircle } from "@/components/advisor-ui/icons";
import TradePanel from "@/components/trades/trade-panel";
import {
  DEFAULT_FEED_FILTERS,
  FEED_FILTER_GROUPS,
  type FeedFilters,
} from "@/components/feed/feed-filter";
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

type AdvisorCard = {
  id: number;
  fullName: string;
  image: string | null;
  expertise: string[];
  tradeCount: number;
  sponsored: boolean;
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

// The sidebar owns every filter. FEED_FILTER_GROUPS.asset uses a different
// taxonomy than the trade asset tabs, so we drop it and use ASSET_TABS instead.
const SIDEBAR_GROUPS = FEED_FILTER_GROUPS.filter((g) => g.key !== "asset");

type Quick = "none" | "open" | "target_hit" | "free" | "premium";

const QUICK_OPTS: { id: Quick; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "target_hit", label: "Target Hit" },
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function AdvisorRailCard({ a }: { a: AdvisorCard }) {
  return (
    <Link href={`/user/advisors/${a.id}`} className="trades-adv">
      {a.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.image} alt="" className="trades-adv-av trades-adv-av-img" />
      ) : (
        <span className="trades-adv-av">{initials(a.fullName)}</span>
      )}
      <span className="trades-adv-body">
        <span className="trades-adv-name">
          {a.fullName}
          <CheckCircle size={12} style={{ color: "#10b981" }} />
        </span>
        <span className="trades-adv-meta">
          {a.expertise.length ? a.expertise.join(" · ") : "SEBI Registered"}
          {a.tradeCount > 0 ? ` · ${a.tradeCount} call${a.tradeCount > 1 ? "s" : ""}` : ""}
        </span>
      </span>
      {a.sponsored && <span className="trades-adv-badge">Sponsored</span>}
    </Link>
  );
}

export default function TradesClient({
  trades,
  isAuthed,
  featuredAdvisors,
  topAdvisors,
}: {
  trades: Trade[];
  isAuthed: boolean;
  featuredAdvisors: AdvisorCard[];
  topAdvisors: AdvisorCard[];
}) {
  const [asset, setAsset] = useState("all");
  const [quick, setQuick] = useState<Quick>("none");
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FEED_FILTERS);

  const sponsoredIds = useMemo(
    () => new Set(featuredAdvisors.map((a) => a.id)),
    [featuredAdvisors],
  );

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
      // Sponsored advisors' calls bubble to the top (paid promotion), then by date.
      const sa = a.advisor && sponsoredIds.has(a.advisor.id) ? 1 : 0;
      const sb = b.advisor && sponsoredIds.has(b.advisor.id) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      const ta = new Date(a.publishedAt ?? a.createdAt).getTime();
      const tb = new Date(b.publishedAt ?? b.createdAt).getTime();
      return filters.sort === "latest" ? tb - ta : ta - tb;
    });
    return list;
  }, [trades, asset, quick, filters, sponsoredIds]);

  const activeFilterCount =
    SIDEBAR_GROUPS.reduce((n, g) => n + (filters[g.key] !== DEFAULT_FEED_FILTERS[g.key] ? 1 : 0), 0) +
    (asset !== "all" ? 1 : 0) +
    (quick !== "none" ? 1 : 0);

  const resetAll = () => {
    setFilters(DEFAULT_FEED_FILTERS);
    setAsset("all");
    setQuick("none");
  };

  return (
    <section>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: -0.5 }}>
          Trades
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Structured BUY / SELL calls from SEBI-registered analysts
        </p>
      </div>

      <div className="trades-layout">
        {/* ── Filters sidebar ─────────────────────────────────────────── */}
        <aside className="trades-sidebar">
          <div className="trades-fcard">
            <div className="trades-fhead">
              <span>Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}</span>
              {activeFilterCount > 0 && (
                <button type="button" onClick={resetAll}>
                  Reset
                </button>
              )}
            </div>

            <div className="trades-fgroup">
              <div className="trades-flabel">Asset</div>
              <div className="trades-fopts">
                {ASSET_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAsset(t.id)}
                    className={`trades-fopt${asset === t.id ? " active" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="trades-fgroup">
              <div className="trades-flabel">Quick filters</div>
              <div className="trades-fopts">
                {QUICK_OPTS.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQuick((cur) => (cur === q.id ? "none" : q.id))}
                    className={`trades-fopt${quick === q.id ? " active" : ""}`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {SIDEBAR_GROUPS.map((g) => (
              <div key={g.key} className="trades-fgroup">
                <div className="trades-flabel">{g.label}</div>
                <div className="trades-fopts">
                  {g.options.map((opt) => {
                    const sel = filters[g.key] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFilters({ ...filters, [g.key]: opt.id })}
                        className={`trades-fopt${sel ? " active" : ""}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Trades list ─────────────────────────────────────────────── */}
        <div className="trades-main">
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
              {visible.map((t) => {
                const sponsored = Boolean(t.advisor && sponsoredIds.has(t.advisor.id));
                return (
                  <article
                    key={t.id}
                    className={sponsored ? "trades-post trades-post-sponsored" : "trades-post"}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 18,
                    }}
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
                          {sponsored && <span className="trades-promoted">Promoted</span>}
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
                );
              })}
            </div>
          )}

          {!isAuthed && (
            <p style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "var(--text-muted)" }}>
              <Link href="/login" style={{ color: "#0ea5e9", fontWeight: 700 }}>Sign in</Link> to like, comment and unlock premium trades.
            </p>
          )}
        </div>

        {/* ── Featured analysts rail ──────────────────────────────────── */}
        <aside className="trades-rail">
          {featuredAdvisors.length > 0 && (
            <div className="trades-rail-card">
              <div className="trades-rail-head">
                <FiStar size={13} /> Featured Analysts
              </div>
              <div className="trades-adv-list">
                {featuredAdvisors.map((a) => (
                  <AdvisorRailCard key={a.id} a={a} />
                ))}
              </div>
            </div>
          )}

          {topAdvisors.length > 0 && (
            <div className="trades-rail-card">
              <div className="trades-rail-head">Top Analysts</div>
              <div className="trades-adv-list">
                {topAdvisors.map((a) => (
                  <AdvisorRailCard key={a.id} a={a} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
