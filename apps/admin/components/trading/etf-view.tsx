"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowDownRight, FiArrowUpRight } from "react-icons/fi";
import AddToWatchlistButton from "@/components/watchlist/add-to-watchlist-button";
import TradeButtons from "@/components/trading/trade-buttons";
import { LoadingTableRows } from "@/components/loading-shimmer";

type Etf = {
  symbol: string;
  name: string;
  token: string;
  exchange: string;
  ltp: number | null;
  percentChange: number | null;
};

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EtfView() {
  const [rows, setRows] = useState<Etf[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [masterCount, setMasterCount] = useState<number | null>(null);
  // First request after a deploy has no cached list yet; the download runs in
  // the background rather than holding the request open for over a minute.
  const [warming, setWarming] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/market/etf", { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (j.ok) {
          setRows(j.etfs ?? []);
          setWarming(Boolean(j.warming));
          setMasterCount(typeof j.masterCount === "number" ? j.masterCount : null);
          setError("");
        } else setError(j.error || "Failed to load ETFs");
      } catch {
        if (alive) setError("Network error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) => r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  return (
    <section>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <p style={{ margin: 0, flex: 1, fontSize: 11.5, color: "var(--text-muted)" }}>
          NSE/BSE ETFs filtered from the Angel One scrip master
          {masterCount != null ? ` · ${masterCount.toLocaleString("en-IN")} instruments` : ""}
          {!loading ? ` · ${rows.length} ETFs` : ""}
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ETF…"
          style={{
            height: 36,
            minWidth: 180,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
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
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "left" }}>ETF</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>LTP</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Change</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingTableRows cols={4} rows={6} />
              ) : warming ? (
                <tr><td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>
                  Building the ETF list from the scrip master — this takes a minute. Refresh shortly.
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>No ETFs matched.</td></tr>
              ) : (
                filtered.slice(0, 200).map((r) => {
                  const pos = (r.percentChange ?? 0) >= 0;
                  const href = `/user/markets/chart?symbol=${encodeURIComponent(r.symbol)}&token=${encodeURIComponent(r.token)}&exchange=${encodeURIComponent(r.exchange)}&type=EQ`;
                  return (
                    <tr key={`${r.exchange}:${r.token}`} className="mkt-trow" style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", textAlign: "left" }}>
                        <Link href={href} style={{ color: "var(--text)", fontWeight: 600, textDecoration: "none" }}>
                          {r.symbol}
                        </Link>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.name}</div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>
                        {r.ltp != null ? `₹${inr(r.ltp)}` : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: r.percentChange == null ? "var(--text-muted)" : pos ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                        {r.percentChange == null ? (
                          "—"
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                            {pos ? <FiArrowUpRight size={13} /> : <FiArrowDownRight size={13} />}
                            {pos ? "+" : ""}
                            {r.percentChange.toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                          {/* ETFs are EQ on NSE — same instrument the paper
                              engine already fills for equities. */}
                          <TradeButtons symbol={r.symbol} instrumentType="EQ" exchange={r.exchange} price={r.ltp} />
                          <AddToWatchlistButton
                            item={{ display: r.symbol, tradingSymbol: r.symbol, token: r.token, exchange: r.exchange, type: "EQ" }}
                            compact
                            label=""
                          />
                        </span>
                      </td>
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
