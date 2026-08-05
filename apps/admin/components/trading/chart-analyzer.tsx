"use client";

import { useCallback, useEffect, useState } from "react";

type Candle = { timestamp: string; open: number; high: number; low: number; close: number; volume: number };

type Reason = { text: string; tone: "good" | "bad" | "neutral" };

function sma(vals: number[], n: number): number | null {
  if (vals.length < n) return null;
  return vals.slice(-n).reduce((a, b) => a + b, 0) / n;
}

function rsi(vals: number[], n = 14): number | null {
  if (vals.length < n + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = vals.length - n; i < vals.length; i++) {
    const d = vals[i] - vals[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const avgGain = gains / n;
  const avgLoss = losses / n;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

type Analysis = {
  verdict: "Bullish" | "Bearish" | "Neutral";
  score: number;
  last: number;
  sma20: number | null;
  sma50: number | null;
  rsi: number | null;
  momentum: number;
  rangePos: number;
  reasons: Reason[];
};

function analyze(candles: Candle[]): Analysis | null {
  const closes = candles.map((c) => c.close).filter((n) => Number.isFinite(n) && n > 0);
  if (closes.length < 25) return null;

  const last = closes[closes.length - 1];
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const r = rsi(closes, 14);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const rangePos = high > low ? (last - low) / (high - low) : 0.5;
  const momN = Math.min(20, closes.length - 1);
  const momentum = (last / closes[closes.length - 1 - momN] - 1) * 100;

  let score = 0;
  const reasons: Reason[] = [];

  if (s20 && s50) {
    if (last > s20 && s20 > s50) {
      score += 35;
      reasons.push({ text: "Price above a rising 20 & 50-day average (uptrend)", tone: "good" });
    } else if (last < s20 && s20 < s50) {
      score -= 35;
      reasons.push({ text: "Price below a falling 20 & 50-day average (downtrend)", tone: "bad" });
    } else {
      reasons.push({ text: "Mixed moving-average trend", tone: "neutral" });
    }
  }
  if (r != null) {
    if (r > 70) {
      score -= 12;
      reasons.push({ text: `RSI ${r.toFixed(0)} — overbought, may be extended`, tone: "bad" });
    } else if (r < 30) {
      score += 12;
      reasons.push({ text: `RSI ${r.toFixed(0)} — oversold, may be due a bounce`, tone: "good" });
    } else {
      reasons.push({ text: `RSI ${r.toFixed(0)} — neutral momentum`, tone: "neutral" });
    }
  }
  if (momentum > 3) {
    score += 20;
    reasons.push({ text: `+${momentum.toFixed(1)}% over the last ${momN} sessions`, tone: "good" });
  } else if (momentum < -3) {
    score -= 20;
    reasons.push({ text: `${momentum.toFixed(1)}% over the last ${momN} sessions`, tone: "bad" });
  }
  if (rangePos > 0.85) reasons.push({ text: "Trading near the top of its recent range", tone: "neutral" });
  else if (rangePos < 0.15) reasons.push({ text: "Trading near the bottom of its recent range", tone: "neutral" });

  const verdict = score >= 30 ? "Bullish" : score <= -30 ? "Bearish" : "Neutral";
  return { verdict, score, last, sma20: s20, sma50: s50, rsi: r, momentum, rangePos, reasons };
}

const VERDICT_TONE: Record<string, { bg: string; color: string; line: string }> = {
  Bullish: { bg: "rgba(22,163,74,0.12)", color: "#15803d", line: "The technical setup looks constructive." },
  Bearish: { bg: "rgba(220,38,38,0.12)", color: "#b91c1c", line: "The technical setup looks weak." },
  Neutral: { bg: "var(--surface-2)", color: "var(--text-muted)", line: "The technical setup is mixed / range-bound." },
};

export default function ChartAnalyzer({
  symbol,
  token,
  exchange,
}: {
  symbol: string;
  token: string;
  exchange: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/v1/market/candles?token=${encodeURIComponent(token)}&exchange=${encodeURIComponent(exchange)}&interval=ONE_DAY&days=250`,
      );
      const j = await res.json();
      if (!j.ok) {
        setError(j.rateLimited ? "Live data paused (rate limit). Try again shortly." : j.error || "Couldn't load chart data.");
        setAnalysis(null);
        return;
      }
      const a = analyze(j.data ?? []);
      if (!a) setError("Not enough history to analyze this instrument yet.");
      setAnalysis(a);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [token, exchange]);

  useEffect(() => {
    run();
  }, [run]);

  const tone = analysis ? VERDICT_TONE[analysis.verdict] : null;

  return (
    <article
      style={{
        marginTop: 16,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 22 }}>🤖</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>Chart Analyst</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Technical read of {symbol} · daily candles</div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? "Analyzing…" : "Re-analyze"}
        </button>
      </div>

      <div style={{ padding: 16 }}>
        {error ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{error}</p>
        ) : !analysis ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Analyzing the chart…</p>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: tone!.bg,
                  color: tone!.color,
                }}
              >
                Technical signal: {analysis.verdict}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{tone!.line}</span>
            </div>

            {/* Key readings */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
              {[
                { k: "Last", v: `₹${analysis.last.toFixed(2)}` },
                { k: "20-DMA", v: analysis.sma20 ? `₹${analysis.sma20.toFixed(2)}` : "—" },
                { k: "50-DMA", v: analysis.sma50 ? `₹${analysis.sma50.toFixed(2)}` : "—" },
                { k: "RSI (14)", v: analysis.rsi != null ? analysis.rsi.toFixed(0) : "—" },
                { k: "Momentum", v: `${analysis.momentum >= 0 ? "+" : ""}${analysis.momentum.toFixed(1)}%` },
              ].map((r) => (
                <div key={r.k} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.k}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{r.v}</div>
                </div>
              ))}
            </div>

            {/* Reasons */}
            <ul style={{ margin: "0 0 14px", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {analysis.reasons.map((r, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)" }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      flexShrink: 0,
                      background: r.tone === "good" ? "#16a34a" : r.tone === "bad" ? "#dc2626" : "var(--text-muted)",
                    }}
                  />
                  {r.text}
                </li>
              ))}
            </ul>

            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              ⚠️ This is an automated <strong>technical</strong> read of price &amp; momentum for education only —
              <strong> not investment advice</strong>, and not a buy/sell recommendation. Finuer is not a SEBI-registered
              adviser. Do your own research or consult a registered professional before investing.
            </p>
          </>
        )}
      </div>
    </article>
  );
}
