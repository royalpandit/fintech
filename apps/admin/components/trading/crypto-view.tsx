"use client";

import { useEffect, useState } from "react";
import { FiArrowUpRight, FiArrowDownRight } from "react-icons/fi";

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

  return (
    <section>
      <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--text-muted)" }}>
          Top crypto by market cap · prices in INR (CoinGecko) · live ticks Binance → Coinbase
      </p>
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
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "left" }}>Coin</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Price</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>24h</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Market Cap</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
              ) : coins.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No data.</td></tr>
              ) : (
                coins.map((c) => {
                  const pos = c.change24h >= 0;
                  return (
                    <tr key={c.id} className="mkt-trow" style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px" }}>
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
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--text)" }}>₹{inr(c.price)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: pos ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                          {pos ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
                          {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-muted)" }}>{compactINR(c.marketCap)}</td>
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
