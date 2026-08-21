"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Quote = {
  displaySymbol: string;
  ltp: number;
  percentChange: number;
};

type FxRate = { code: string; inrValue: number; changePct: number | null };

const DISPLAY = ["NIFTY 50", "SENSEX", "NIFTY BANK"];

function sparkPath(up: boolean) {
  const c = up ? "#16a34a" : "#dc2626";
  const d = up
    ? "M0,20 L8,16 L16,18 L24,10 L32,12 L40,4 L48,8 L56,2"
    : "M0,4 L8,8 L16,6 L24,14 L32,12 L40,18 L48,14 L56,20";
  return (
    <svg className="lp-ticker-spark" viewBox="0 0 56 24" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={c} strokeWidth="2" />
    </svg>
  );
}

export default function LandingTicker() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [usdInr, setUsdInr] = useState<FxRate | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/market/live", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        const picked = json.data.filter((x: { displaySymbol: string }) => {
          const sym = (x.displaySymbol ?? "").toUpperCase();
          return DISPLAY.some(d => sym.includes(d.replace("NIFTY BANK", "BANK").split(" ")[0]));
        }) as Quote[];
        setQuotes(picked.length >= 2 ? picked.slice(0, 3) : json.data.slice(0, 3));
      }
    } catch { /* silent */ }
  }, []);

  const loadFx = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/market/fx", { cache: "no-store" });
      const json = await res.json();
      const usd = (json.rates as FxRate[] | undefined)?.find(r => r.code === "USD");
      if (usd && Number.isFinite(usd.inrValue)) setUsdInr(usd);
    } catch { /* silent — the card falls back to a dash */ }
  }, []);

  useEffect(() => {
    load();
    loadFx();
    const id = setInterval(load, 30_000);
    // FX is cached upstream for 10 minutes, so polling faster buys nothing.
    const fxId = setInterval(loadFx, 5 * 60_000);
    return () => {
      clearInterval(id);
      clearInterval(fxId);
    };
  }, [load, loadFx]);

  const fallback: Quote[] = [
    { displaySymbol: "NIFTY 50", ltp: 24832.5, percentChange: 0.42 },
    { displaySymbol: "SENSEX", ltp: 81642.1, percentChange: -0.18 },
    { displaySymbol: "NIFTY BANK", ltp: 52104.3, percentChange: 0.65 },
  ];

  const rows = quotes.length >= 2 ? quotes : fallback;

  return (
    <section className="lp-ticker">
      <div className="landing-container">
        <div className="lp-ticker-row">
          {rows.map(q => {
            const up = (q.percentChange ?? 0) >= 0;
            return (
              <div key={q.displaySymbol} className="lp-ticker-card">
                <div className="lp-ticker-name">{q.displaySymbol}</div>
                <div className="lp-ticker-price">
                  {q.ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
                <div className={`lp-ticker-chg ${up ? "up" : "down"}`}>
                  {up ? "▲" : "▼"} {Math.abs(q.percentChange ?? 0).toFixed(2)}%
                </div>
                {sparkPath(up)}
              </div>
            );
          })}
          {/* Was pinned at a hardcoded 83.42 — roughly 13% off the live rate. */}
          <div className="lp-ticker-card" style={{ flex: "1 0 200px" }}>
            <div className="lp-ticker-name">USD/INR</div>
            <div className="lp-ticker-price">
              {usdInr ? usdInr.inrValue.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
            </div>
            {usdInr?.changePct != null ? (
              <div className={`lp-ticker-chg ${usdInr.changePct >= 0 ? "up" : "down"}`}>
                {usdInr.changePct >= 0 ? "▲" : "▼"} {Math.abs(usdInr.changePct).toFixed(2)}%
              </div>
            ) : (
              <div className="lp-ticker-chg" />
            )}
            {sparkPath((usdInr?.changePct ?? 0) >= 0)}
          </div>
          <Link href="/register" className="lp-ticker-link">View all markets →</Link>
        </div>
      </div>
    </section>
  );
}
