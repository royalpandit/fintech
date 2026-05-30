"use client";

import { useEffect, useState, useCallback } from "react";
import CandlestickChart from "@/components/advisor-ui/candlestick-chart";
import type { Candle, CandleInterval } from "@/lib/angelone-types";

const SYMBOLS = [
  "NIFTY 50",
  "SENSEX",
  "NIFTY BANK",
  "RELIANCE",
  "TCS",
  "HDFCBANK",
  "INFY",
  "ICICIBANK",
  "WIPRO",
  "SBIN",
] as const;

type Range = { label: string; days: number; interval: CandleInterval };

const RANGES: Range[] = [
  { label: "1W", days: 7, interval: "ONE_HOUR" },
  { label: "1M", days: 30, interval: "ONE_DAY" },
  { label: "3M", days: 90, interval: "ONE_DAY" },
  { label: "6M", days: 180, interval: "ONE_DAY" },
  { label: "1Y", days: 365, interval: "ONE_DAY" },
];

function formatPrice(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function LiveCandleChart({
  defaultSymbol = "NIFTY 50",
}: {
  defaultSymbol?: string;
}) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [range, setRange] = useState<Range>(RANGES[1]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/market/candles?symbol=${encodeURIComponent(symbol)}&interval=${range.interval}&days=${range.days}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.ok) {
        setCandles(json.data);
      } else {
        setError(json.error ?? "Failed to fetch");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [symbol, range]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  const last = candles[candles.length - 1];
  const first = candles[0];
  const pctChange =
    first && last
      ? ((last.close - first.open) / first.open) * 100
      : null;
  const up = pctChange !== null && pctChange >= 0;

  return (
    <div>
      {/* Symbol selector */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSymbol(s)}
            style={{
              padding: "5px 11px",
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid",
              cursor: "pointer",
              background: symbol === s ? "var(--text)" : "var(--surface)",
              color: symbol === s ? "#fff" : "var(--text-muted)",
              borderColor: symbol === s ? "var(--text)" : "var(--border)",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
            {last ? formatPrice(last.close) : "—"}
          </span>
          {pctChange !== null && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 13,
                fontWeight: 700,
                color: up ? "#16a34a" : "#dc2626",
              }}
            >
              {up ? "▲" : "▼"} {Math.abs(pctChange).toFixed(2)}%{" "}
              <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>
                ({range.label})
              </span>
            </span>
          )}
        </div>

        {/* Time-range selector */}
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(r)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background:
                  range.label === r.label
                    ? "rgba(14,165,233,0.12)"
                    : "transparent",
                color:
                  range.label === r.label ? "var(--brand-primary)" : "var(--text-muted)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div
          style={{
            height: 280,
            borderRadius: 10,
            background: "var(--hover)",
            display: "grid",
            placeItems: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          Loading chart…
        </div>
      ) : error ? (
        <div
          style={{
            height: 280,
            display: "grid",
            placeItems: "center",
            color: "#dc2626",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : (
        <CandlestickChart data={candles} height={280} />
      )}

      {/* OHLCV summary */}
      {last && !loading && (
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 10,
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          {[
            ["O", last.open],
            ["H", last.high],
            ["L", last.low],
            ["C", last.close],
          ].map(([label, val]) => (
            <span key={label as string}>
              <span style={{ fontWeight: 700, color: "var(--text)" }}>
                {label}
              </span>{" "}
              {formatPrice(val as number)}
            </span>
          ))}
          <span>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>Vol</span>{" "}
            {Number(last.volume).toLocaleString("en-IN")}
          </span>
        </div>
      )}
    </div>
  );
}
