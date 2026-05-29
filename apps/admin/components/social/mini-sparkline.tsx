"use client";

import { useEffect, useState } from "react";

export default function MiniSparkline({
  token,
  exchange,
  tradingSymbol,
  className = "",
}: {
  token: string;
  exchange: string;
  tradingSymbol: string;
  className?: string;
}) {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          token,
          exchange,
          tradingSymbol,
          interval: "FIVE_MINUTE",
          days: "1",
        });
        const res = await fetch(`/api/v1/market/candles?${params}`, { cache: "no-store" });
        const json = await res.json();
        if (!json.ok || !Array.isArray(json.data)) return;
        const closes = json.data
          .slice(-24)
          .map((c: { close: number }) => Number(c.close))
          .filter((n: number) => Number.isFinite(n));
        if (!cancelled && closes.length > 1) setPoints(closes);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, exchange, tradingSymbol]);

  if (points.length < 2) {
    return <div className={`sf-sparkline sf-sparkline-empty ${className}`} />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const up = points[points.length - 1] >= points[0];

  return (
    <svg
      className={`sf-sparkline ${up ? "up" : "down"} ${className}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={d} fill="none" strokeWidth="1.5" />
    </svg>
  );
}
