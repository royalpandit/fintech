"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatINR, formatPct } from "@/lib/competition-trading";
import { UserPageBackLink, UserPageSection } from "@/components/user/user-page-layout";

type Tab = "overview" | "portfolio" | "holdings" | "orders" | "leaderboard" | "participants" | "rules";

type Competition = {
  id: number;
  title: string;
  description?: string | null;
  effectiveStatus: string;
  prizePool: number | null;
  participantCount: number;
  startDate: string;
  endDate: string;
  joined: boolean;
  prizes: { rankLabel: string; displayValue: string }[];
  rules?: string;
};

type Portfolio = {
  initialCapital: number;
  cashBalance: number;
  investedAmount: number;
  portfolioValue: number;
  totalReturn: number;
  todayReturn: number;
  rank: number | null;
};

type Holding = {
  id: number;
  stockSymbol: string;
  companyName: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercentage: number;
};

type Order = {
  id: number;
  stockSymbol: string;
  companyName: string;
  transactionType: string;
  quantity: number;
  price: number;
  totalAmount: number;
  orderTime: string;
};

type LeaderboardRow = {
  rank: number | null;
  userName: string;
  profileImage: string | null;
  portfolioValue: number | null;
  totalReturn: number | null;
};

type Participant = {
  userName: string;
  roleLabel: string;
  joinedAt: string;
};

type SearchHit = {
  tradingSymbol: string;
  symbolName: string;
  exchange: string;
  token: string;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "portfolio", label: "Portfolio" },
  { id: "holdings", label: "Holdings" },
  { id: "orders", label: "Orders" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "participants", label: "Participants" },
  { id: "rules", label: "Rules" },
];

function getToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
  return m ? m[1] : null;
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function UserCompetitionTradeClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const tab = (searchParams.get("tab") as Tab) || "overview";

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [orderFilter, setOrderFilter] = useState<"all" | "buy" | "sell">("all");
  const [loading, setLoading] = useState(true);

  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [qty, setQty] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [buyCmp, setBuyCmp] = useState<number | null>(null);
  const [buyCmpPct, setBuyCmpPct] = useState<number | null>(null);
  const [buyCmpLoading, setBuyCmpLoading] = useState(false);
  const [sellCmp, setSellCmp] = useState<number | null>(null);
  const [trading, setTrading] = useState(false);
  const [sellSymbol, setSellSymbol] = useState("");

  const canTrade = competition?.effectiveStatus === "live";

  const loadCore = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      fetch(`/api/v1/competitions/${id}`, { headers: authHeaders() }),
      fetch(`/api/v1/competitions/${id}/portfolio`, { headers: authHeaders() }),
    ]);
    const cj = await cRes.json();
    const pj = await pRes.json();
    if (cj.ok) setCompetition(cj.data);
    if (pj.ok) setPortfolio(pj.data);
    setLoading(false);
  }, [id]);

  const loadTab = useCallback(async () => {
    if (tab === "holdings" || tab === "portfolio" || tab === "overview") {
      const r = await fetch(`/api/v1/competitions/${id}/holdings`, { headers: authHeaders() });
      const j = await r.json();
      if (j.ok) setHoldings(j.data);
    }
    if (tab === "orders" || tab === "portfolio") {
      const r = await fetch(`/api/v1/competitions/${id}/orders?type=${orderFilter}`, {
        headers: authHeaders(),
      });
      const j = await r.json();
      if (j.ok) setOrders(j.data);
    }
    if (tab === "leaderboard" || tab === "overview") {
      const r = await fetch(`/api/v1/competitions/${id}/leaderboard`);
      const j = await r.json();
      if (j.ok) setLeaderboard(j.data);
    }
    if (tab === "participants") {
      const r = await fetch(`/api/v1/competitions/${id}/participants`);
      const j = await r.json();
      if (j.ok) setParticipants(j.data);
    }
    if (tab === "portfolio" || tab === "overview") {
      const r = await fetch(`/api/v1/competitions/${id}/portfolio`, { headers: authHeaders() });
      const j = await r.json();
      if (j.ok) setPortfolio(j.data);
    }
  }, [id, tab, orderFilter]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (!loading) loadTab();
  }, [loading, loadTab]);

  useEffect(() => {
    if (searchQ.length < 2) {
      setSearchHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/v1/market/search?q=${encodeURIComponent(searchQ)}`);
      const j = await r.json();
      if (j.ok) setSearchHits((j.data ?? []).slice(0, 8));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function fetchCmpForStock(hit: SearchHit) {
    setBuyCmpLoading(true);
    setBuyCmp(null);
    setBuyCmpPct(null);
    try {
      const params = new URLSearchParams({
        exchange: hit.exchange,
        symbol: hit.tradingSymbol,
        token: hit.token,
      });
      const r = await fetch(`/api/v1/market/tick?${params}`);
      const j = await r.json();
      if (j.ok && j.ltp > 0) {
        setBuyCmp(j.ltp);
        setBuyCmpPct(j.pctChange ?? null);
        setBuyPrice(String(j.ltp));
      }
    } finally {
      setBuyCmpLoading(false);
    }
  }

  function selectStock(hit: SearchHit) {
    setSelected(hit);
    setSearchQ(hit.tradingSymbol);
    setSearchHits([]);
    void fetchCmpForStock(hit);
  }

  useEffect(() => {
    if (!sellSymbol) {
      setSellCmp(null);
      return;
    }
    const h = holdings.find((x) => x.stockSymbol === sellSymbol);
    if (h) {
      setSellCmp(h.currentPrice);
      setSellPrice(String(h.currentPrice));
    }
  }, [sellSymbol, holdings]);

  async function executeBuy(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setTrading(true);
    const r = await fetch(`/api/v1/competitions/${id}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        stockSymbol: selected.tradingSymbol,
        companyName: selected.symbolName,
        quantity: Number(qty),
        price: buyPrice ? Number(buyPrice) : 0,
        exchange: selected.exchange,
        symbolToken: selected.token,
      }),
    });
    const j = await r.json();
    setTrading(false);
    if (j.ok) {
      setPortfolio(j.data);
      loadTab();
      setSelected(null);
      setSearchQ("");
      setBuyCmp(null);
      setBuyCmpPct(null);
      setBuyPrice("");
    } else alert(j.error || "Buy failed");
  }

  async function executeSell(e: FormEvent) {
    e.preventDefault();
    if (!sellSymbol) return;
    const h = holdings.find((x) => x.stockSymbol === sellSymbol);
    if (!h) return;
    setTrading(true);
    const r = await fetch(`/api/v1/competitions/${id}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        stockSymbol: h.stockSymbol,
        companyName: h.companyName,
        quantity: Number(qty),
        price: sellPrice ? Number(sellPrice) : 0,
        exchange: "NSE",
      }),
    });
    const j = await r.json();
    setTrading(false);
    if (j.ok) {
      setPortfolio(j.data);
      loadTab();
    } else alert(j.error || "Sell failed");
  }

  if (loading) {
    return (
      <UserPageSection>
        <p>Loading competition…</p>
      </UserPageSection>
    );
  }

  if (!competition) {
    return (
      <UserPageSection>
        <UserPageBackLink href="/user/competition">← Back</UserPageBackLink>
        <p>Competition not found.</p>
      </UserPageSection>
    );
  }

  return (
    <UserPageSection>
      <UserPageBackLink href="/user/competition">← Back to Competitions</UserPageBackLink>

      <div className="competition-trade-header">
        <div>
          <h1 className="competition-detail-title">{competition.title}</h1>
          <span className={`competition-card-status competition-card-status--${competition.effectiveStatus}`}>
            {competition.effectiveStatus}
          </span>
        </div>
        {portfolio ? (
          <div className="competition-trade-summary-pill">
            <span>Portfolio {formatINR(portfolio.portfolioValue)}</span>
            <span className={portfolio.totalReturn >= 0 ? "text-green" : "text-red"}>
              {formatPct(portfolio.totalReturn)}
            </span>
            {portfolio.rank ? <span>Rank #{portfolio.rank}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="competition-tabs competition-tabs--trade">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/user/competition/${id}/trade?tab=${t.id}`}
            className={`competition-tab${tab === t.id ? " competition-tab--active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="competition-trade-grid">
          <div className="competition-trade-panel">
            <h3>Competition Info</h3>
            <p>Prize Pool: {formatINR(competition.prizePool)}</p>
            <p>Participants: {competition.participantCount}</p>
            <p>Start: {new Date(competition.startDate).toLocaleString()}</p>
            <p>End: {new Date(competition.endDate).toLocaleString()}</p>
            {competition.description ? <p>{competition.description}</p> : null}
          </div>
          {portfolio ? (
            <div className="competition-trade-panel">
              <h3>Your Standing</h3>
              <div className="competition-portfolio-stats">
                <div><span>Portfolio Value</span><strong>{formatINR(portfolio.portfolioValue)}</strong></div>
                <div><span>Total Return</span><strong>{formatPct(portfolio.totalReturn)}</strong></div>
                <div><span>Rank</span><strong>{portfolio.rank ?? "—"}</strong></div>
                <div><span>Cash</span><strong>{formatINR(portfolio.cashBalance)}</strong></div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {tab === "portfolio" && portfolio && (
        <div>
          <div className="competition-portfolio-stats competition-portfolio-stats--large">
            <div><span>Initial Capital</span><strong>{formatINR(portfolio.initialCapital)}</strong></div>
            <div><span>Cash Balance</span><strong>{formatINR(portfolio.cashBalance)}</strong></div>
            <div><span>Invested</span><strong>{formatINR(portfolio.investedAmount)}</strong></div>
            <div><span>Portfolio Value</span><strong>{formatINR(portfolio.portfolioValue)}</strong></div>
            <div><span>Today&apos;s Return</span><strong>{formatPct(portfolio.todayReturn)}</strong></div>
            <div><span>Total Return</span><strong>{formatPct(portfolio.totalReturn)}</strong></div>
            <div><span>Current Rank</span><strong>{portfolio.rank ?? "—"}</strong></div>
          </div>

          {canTrade ? (
            <div className="competition-trade-forms">
              <form className="competition-trade-panel" onSubmit={executeBuy}>
                <h3>Buy Stock</h3>
                <input
                  className="competition-input"
                  placeholder="Search stock (e.g. RELIANCE)"
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value);
                    setSelected(null);
                    setBuyCmp(null);
                    setBuyCmpPct(null);
                  }}
                />
                {searchHits.length > 0 && !selected ? (
                  <div className="competition-search-dropdown">
                    {searchHits.map((h) => (
                      <button
                        key={`${h.exchange}-${h.token}`}
                        type="button"
                        onClick={() => selectStock(h)}
                      >
                        {h.tradingSymbol} — {h.symbolName}
                      </button>
                    ))}
                  </div>
                ) : null}
                {selected ? (
                  <div className="competition-cmp-box">
                    <div className="competition-cmp-stock">
                      <strong>{selected.tradingSymbol}</strong>
                      <span>{selected.symbolName}</span>
                    </div>
                    <div className="competition-cmp-price">
                      <span className="competition-cmp-label">CMP</span>
                      {buyCmpLoading ? (
                        <span>Loading…</span>
                      ) : buyCmp != null ? (
                        <>
                          <strong>{formatINR(buyCmp)}</strong>
                          {buyCmpPct != null ? (
                            <span className={buyCmpPct >= 0 ? "text-green" : "text-red"}>
                              {formatPct(buyCmpPct)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    {buyCmp != null && qty ? (
                      <p className="competition-cmp-estimate">
                        Est. cost: {formatINR(buyCmp * Number(qty || 0))}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <input className="competition-input" type="number" min={1} placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
                <input className="competition-input" type="number" step="0.01" placeholder="Price (optional — defaults to CMP)" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
                <button type="submit" className="competition-card-join-btn" disabled={trading || !selected}>
                  {trading ? "Placing…" : "Buy"}
                </button>
              </form>

              <form className="competition-trade-panel" onSubmit={executeSell}>
                <h3>Sell Stock</h3>
                <select className="competition-input" value={sellSymbol} onChange={(e) => setSellSymbol(e.target.value)}>
                  <option value="">Select holding</option>
                  {holdings.map((h) => (
                    <option key={h.id} value={h.stockSymbol}>
                      {h.stockSymbol} ({h.quantity} shares)
                    </option>
                  ))}
                </select>
                {sellSymbol && sellCmp != null ? (
                  <div className="competition-cmp-box competition-cmp-box--compact">
                    <span className="competition-cmp-label">CMP</span>
                    <strong>{formatINR(sellCmp)}</strong>
                  </div>
                ) : null}
                <input className="competition-input" type="number" min={1} placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
                <input className="competition-input" type="number" step="0.01" placeholder="Price (optional — defaults to CMP)" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
                <button type="submit" className="competition-card-view-btn" disabled={trading || !sellSymbol}>
                  {trading ? "Placing…" : "Sell"}
                </button>
              </form>
            </div>
          ) : (
            <p className="competition-empty">Trading is closed for this competition.</p>
          )}
        </div>
      )}

      {tab === "holdings" && (
        <div className="competition-table-wrap">
          <table className="competition-table">
            <thead>
              <tr>
                {["Stock", "Qty", "Avg Price", "Current", "Mkt Value", "P&L", "P&L %"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.length === 0 ? (
                <tr><td colSpan={7}>No holdings yet. Buy stocks from Portfolio tab.</td></tr>
              ) : (
                holdings.map((h) => (
                  <tr key={h.id}>
                    <td><strong>{h.stockSymbol}</strong><br /><small>{h.companyName}</small></td>
                    <td>{h.quantity}</td>
                    <td>{formatINR(h.avgBuyPrice)}</td>
                    <td>{formatINR(h.currentPrice)}</td>
                    <td>{formatINR(h.marketValue)}</td>
                    <td className={h.pnl >= 0 ? "text-green" : "text-red"}>{formatINR(h.pnl)}</td>
                    <td className={h.pnlPercentage >= 0 ? "text-green" : "text-red"}>{formatPct(h.pnlPercentage)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "orders" && (
        <div>
          <div className="competition-order-filters">
            {(["all", "buy", "sell"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`competition-tab${orderFilter === f ? " competition-tab--active" : ""}`}
                onClick={() => setOrderFilter(f)}
              >
                {f === "all" ? "All" : f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="competition-table-wrap">
            <table className="competition-table">
              <thead>
                <tr>{["Stock", "Type", "Qty", "Price", "Amount", "Time"].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={6}>No orders yet.</td></tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.stockSymbol}</td>
                      <td className={o.transactionType === "buy" ? "text-green" : "text-red"}>{o.transactionType.toUpperCase()}</td>
                      <td>{o.quantity}</td>
                      <td>{formatINR(o.price)}</td>
                      <td>{formatINR(o.totalAmount)}</td>
                      <td>{new Date(o.orderTime).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "leaderboard" && (
        <div className="competition-leaderboard">
          {leaderboard.map((row) => {
            const badge = row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank;
            return (
              <div key={`${row.userName}-${row.rank}`} className={`competition-lb-row${(row.rank ?? 99) <= 3 ? " competition-lb-row--top" : ""}`}>
                <div className="competition-lb-rank">{badge}</div>
                <div className="competition-lb-user"><span>{row.userName}</span></div>
                <div className="competition-lb-stat"><span className="competition-lb-stat-label">Portfolio</span><span>{formatINR(row.portfolioValue)}</span></div>
                <div className="competition-lb-stat"><span className="competition-lb-stat-label">Return</span><span>{formatPct(row.totalReturn)}</span></div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "participants" && (
        <div className="competition-table-wrap">
          <table className="competition-table">
            <thead><tr><th>Name</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {participants.map((p, i) => (
                <tr key={i}>
                  <td>{p.userName}</td>
                  <td>{p.roleLabel}</td>
                  <td>{new Date(p.joinedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "rules" && (
        <div className="competition-trade-panel">
          <h3>Rules</h3>
          <p>{competition.rules}</p>
          <ul>
            <li>Each participant receives ₹10,00,000 virtual capital on joining.</li>
            <li>Buy and sell NSE stocks during the live competition window.</li>
            <li>Rankings are based on total portfolio return %.</li>
            <li>Trading is disabled when the competition ends.</li>
            <li>Winners are declared automatically based on final rankings.</li>
          </ul>
          {competition.prizes.length > 0 ? (
            <>
              <h4>Prize Distribution</h4>
              <ul>
                {competition.prizes.map((p, i) => (
                  <li key={i}>{p.rankLabel}: {p.displayValue}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )}
    </UserPageSection>
  );
}
