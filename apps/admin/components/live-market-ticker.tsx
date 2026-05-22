"use client";

import { useEffect, useState, useCallback } from "react";

interface Quote {
  displaySymbol: string;
  ltp: number;
  open: number;
  close: number;
  percentChange: number;
  netChange: number;
}

const REFRESH_MS = 30_000;

export default function LiveMarketTicker() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/market/live", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setQuotes(json.data);
        setLastUpdated(new Date());
      }
    } catch {
      // silently retry next interval
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    const id = setInterval(fetchQuotes, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchQuotes]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          padding: "10px 0",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              minWidth: 120,
              height: 52,
              borderRadius: 10,
              background: "#f1f5f9",
              flexShrink: 0,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (quotes.length === 0) return null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          padding: "2px 0 10px",
          scrollbarWidth: "none",
        }}
      >
        {quotes.map((q) => {
          const up = q.percentChange >= 0;
          const color = up ? "#16a34a" : "#dc2626";
          const bg = up ? "rgba(22,163,74,0.07)" : "rgba(220,38,38,0.07)";
          return (
            <div
              key={q.displaySymbol}
              style={{
                minWidth: 130,
                flexShrink: 0,
                padding: "10px 14px",
                borderRadius: 10,
                background: bg,
                border: `1px solid ${color}22`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: 0.4,
                  marginBottom: 3,
                }}
              >
                {q.displaySymbol}
              </div>
              <div
                style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}
              >
                ₹{Number(q.ltp).toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color }}>
                {up ? "▲" : "▼"} {Math.abs(q.percentChange).toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
      {lastUpdated && (
        <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>
          Live · updated {lastUpdated.toLocaleTimeString("en-IN")} · refreshes
          every 30s
        </p>
      )}
    </div>
  );
}
