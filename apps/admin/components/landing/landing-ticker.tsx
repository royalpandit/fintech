"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Quote = {
  displaySymbol: string;
  ltp: number;
  percentChange: number;
};

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

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

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
          <div className="lp-ticker-card" style={{ flex: "1 0 200px" }}>
            <div className="lp-ticker-name">USD/INR</div>
            <div className="lp-ticker-price">83.42</div>
            <div className="lp-ticker-chg down">▼ 0.12%</div>
            {sparkPath(false)}
          </div>
          <Link href="/register" className="lp-ticker-link">View all markets →</Link>
        </div>
      </div>
    </section>
  );
}
