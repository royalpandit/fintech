"use client";

import { useEffect, useMemo, useState } from "react";
import { FiArrowUpRight, FiArrowDownRight, FiSearch, FiX } from "react-icons/fi";
import { LoadingTableRows } from "@/components/loading-shimmer";

type Coin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  marketCap: number;
};

const inr = (n: number) =>
  n >= 1
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : n.toLocaleString("en-IN", { maximumFractionDigits: 6 });

function compactINR(n: number) {
  if (n >= 1e12) return `₹${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toFixed(0)}`;
}

export default function CryptoView() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/market/crypto");
        const j = await res.json();
        if (!alive) return;
        if ((j.ok || j.status) && j.coins) {
          setCoins(j.coins);
          setError("");
        } else setError(j.error || "Failed to load crypto");
      } catch {
        if (alive) setError("Network error");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!coins.length) return;
    const ids = coins.map((c) => c.id).join(",");
    const geckoBtcInr = coins.find((c) => c.id === "bitcoin")?.price ?? 0;
    const usdInr = { current: 0 };
    const es = new EventSource(`/api/v1/market/crypto/stream?ids=${encodeURIComponent(ids)}`);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as {
          type?: string;
          id?: string;
          priceUsd?: number;
          change24h?: number;
        };
        if (msg.type !== "tick" || !msg.id || !msg.priceUsd) return;
        if (msg.id === "bitcoin" && geckoBtcInr > 0 && !usdInr.current) {
          usdInr.current = geckoBtcInr / msg.priceUsd;
        }
        const rate = usdInr.current;
        setCoins((prev) =>
          prev.map((c) => {
            if (c.id !== msg.id) return c;
            const price = rate > 0 ? msg.priceUsd! * rate : c.price;
            return {
              ...c,
              price: Number.isFinite(price) && price > 0 ? price : c.price,
              change24h: typeof msg.change24h === "number" ? msg.change24h : c.change24h,
            };
          }),
        );
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [coins.length]);

  // Search runs over symbol + name + coingecko id, so "btc", "Bitcoin" and
  // "bitcoin" all hit. Filtering is client-side over the already-loaded list —
  // live SSE ticks keep updating the rows while a query is active.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return coins;
    return coins.filter(
      (c) =>
        c.symbol.toLowerCase().includes(needle) ||
        c.name.toLowerCase().includes(needle) ||
        c.id.toLowerCase().includes(needle),
    );
  }, [coins, q]);

  const query = q.trim();

  return (
    <section>
      <div className="mkt-toolbar">
        <p className="mkt-toolbar-blurb">
          Top crypto by market cap · prices in INR (CoinGecko) · live ticks Binance → Coinbase
        </p>
        <div className="mkt-search">
          <FiSearch size={15} className="mkt-search-icon" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search coin (BTC, Ethereum…)"
            aria-label="Search cryptocurrencies"
          />
          {query && (
            <button
              type="button"
              className="mkt-search-clear"
              onClick={() => setQ("")}
              aria-label="Clear search"
            >
              <FiX size={13} />
            </button>
          )}
        </div>
        {!loading && (
          <span className="mkt-count">
            {query ? `${filtered.length} of ${coins.length}` : `${coins.length} coins`}
          </span>
        )}
      </div>
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}
      <article style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              {/* globals.css has `th, td { text-align: left }` — a real
                  declaration, so it beats text-align inherited from <tr>.
                  Each numeric header has to set its own alignment or it sits
                  left of the right-aligned values below it. */}
              <tr style={{ color: "var(--text-muted)", fontSize: 11 }}>
                <th className="mkt-cell-tight" style={{ padding: "12px 16px", fontWeight: 600, textAlign: "left" }}>Coin</th>
                <th className="mkt-cell-tight" style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Price</th>
                <th className="mkt-cell-tight" style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>24h</th>
                <th className="mkt-col-sm-hide" style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingTableRows cols={4} rows={6} />
              ) : coins.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No data.</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
                    No coins matched “{query}”.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const pos = c.change24h >= 0;
                  return (
                    <tr key={c.id} className="mkt-trow" style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="mkt-cell-tight" style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {c.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.image} alt="" style={{ width: 24, height: 24, borderRadius: 999 }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text)" }}>{c.symbol}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mkt-cell-tight" style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--text)" }}>₹{inr(c.price)}</td>
                      <td className="mkt-cell-tight" style={{ padding: "12px 16px", textAlign: "right", color: pos ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                          {pos ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
                          {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(2)}%
                        </span>
                      </td>
                      <td className="mkt-col-sm-hide" style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-muted)" }}>{compactINR(c.marketCap)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
