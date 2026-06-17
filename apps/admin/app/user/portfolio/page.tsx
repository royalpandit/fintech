import Link from "next/link";
import type { ComponentType } from "react";
import { cookies } from "next/headers";
import {
  FiBriefcase,
  FiLock,
  FiBarChart2,
  FiTarget,
  FiTrendingUp,
} from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import PaperPortfolioSection from "@/components/paper/paper-portfolio-section";
import AreaChart from "@/components/advisor-ui/area-chart";
import DonutChart from "@/components/advisor-ui/donut-chart";
import LiveCandleChart from "@/components/live-candle-chart";
import { getHoldings } from "@/lib/angelone";

export const dynamic = "force-dynamic";

function formatINR(n: number, compact = false) {
  if (!n && n !== 0) return "₹0";
  if (compact && Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (compact && Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SYMBOL_COLORS: Record<string, string> = {
  AAPL: "#0f172a",
  RELIANCE: "#0ea5e9",
  TCS: "#7c3aed",
  INFY: "#10b981",
  HDFCBANK: "#dc2626",
  ICICIBANK: "#f59e0b",
};

export default async function PortfolioPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  const [portfolios, holdings, snapshots, brokerAccounts, liveHoldings] =
    await Promise.all([
      userId
        ? prisma.portfolio.findMany({
            where: { userId, deletedAt: null },
            orderBy: { totalValue: "desc" },
          })
        : Promise.resolve([]),
      userId
        ? prisma.portfolioAsset.findMany({
            where: { portfolio: { userId, deletedAt: null } },
            orderBy: { quantity: "desc" },
          })
        : Promise.resolve([]),
      userId
        ? prisma.portfolioSnapshotDaily.findMany({
            where: { portfolio: { userId } },
            orderBy: { day: "asc" },
            take: 90,
          })
        : Promise.resolve([]),
      userId
        ? prisma.brokerAccount.findMany({ where: { userId } })
        : Promise.resolve([]),
      // Always try to fetch live Angel One holdings
      getHoldings().catch(() => [] as Awaited<ReturnType<typeof getHoldings>>),
    ]);

  const activePortfolio = portfolios[0];
  const totalValue = activePortfolio ? Number(activePortfolio.totalValue) : 0;
  const dayChange = activePortfolio ? Number(activePortfolio.dayChange) : 0;
  const riskScore = activePortfolio ? Number(activePortfolio.riskScore) : 0;
  const diversificationScore = activePortfolio
    ? Number(activePortfolio.diversificationScore)
    : 0;

  const chartData = snapshots.map((s) => ({
    label: dayLabel(s.day),
    value: Number(s.totalValue),
  }));

  // Sector grouping for donut
  const sectorTotals = new Map<string, number>();
  for (const h of holdings) {
    const sector = h.sector ?? "Others";
    const value = Number(h.currentPrice ?? h.averagePrice) * Number(h.quantity);
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + value);
  }
  const sectorSlices = Array.from(sectorTotals.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([sector, value], i) => ({
      label: sector,
      value,
      color: ["#0ea5e9", "#10b981", "#f59e0b", "#7c3aed", "#dc2626", "#64748b"][i],
      detail: formatINR(value, true),
    }));
  const sectorTotal = sectorSlices.reduce((s, x) => s + x.value, 0);

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: -0.5,
          }}
        >
          Portfolio
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          {isAuthed
            ? "Paper holdings + connected broker portfolio"
            : "Connect your broker for AI-powered portfolio insights"}
        </p>
      </div>

      {isAuthed && userId ? <PaperPortfolioSection userId={userId} /> : null}

      {!isAuthed || !activePortfolio ? (
        <article
          style={{
            background: "linear-gradient(135deg, #0f172a, #064e3b)",
            color: "#fff",
            borderRadius: 18,
            padding: 36,
            marginBottom: 18,
          }}
          className="user-split-hero"
        >
          <div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.16)",
                color: "#a7f3d0",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              <FiBriefcase size={13} /> PORTFOLIO INTELLIGENCE
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: -0.6,
              }}
            >
              Connect once. Get AI insights forever.
            </h2>
            <p
              style={{
                margin: "10px 0 18px",
                color: "rgba(255,255,255,0.78)",
                fontSize: 13,
                lineHeight: 1.5,
                maxWidth: 460,
              }}
            >
              We securely sync your holdings via OAuth and analyze diversification,
              concentration risk, sector exposure, and rebalancing opportunities.
            </p>
            <AuthGate
              isAuthenticated={isAuthed}
              promptTitle="Sign in to connect"
              promptDescription="Sign up to securely link your broker account."
            >
              <button
                type="button"
                style={{
                  padding: "12px 22px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.95)",
                  color: "#064e3b",
                  fontWeight: 800,
                  fontSize: 14,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {isAuthed ? "Connect Broker" : "Get started — free"}
              </button>
            </AuthGate>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {(
              [
                { Icon: FiLock, label: "Bank-grade encryption", detail: "AES-256 token vault" },
                { Icon: FiBarChart2, label: "Risk scoring", detail: "AI-driven 0-10 scale" },
                { Icon: FiTarget, label: "Rebalancing suggestions", detail: "Match your risk profile" },
                { Icon: FiTrendingUp, label: "Real-time tracking", detail: "Updates daily" },
              ] as { Icon: ComponentType<{ size?: number }>; label: string; detail: string }[]
            ).map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", color: "#a7f3d0" }}>
                  <item.Icon size={20} />
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : (
        <>
          {/* Stats strip */}
          <div className="user-stat-grid" style={{ marginBottom: 18 }}>
            {[
              { label: "Total Value", value: formatINR(totalValue, true), color: "var(--text)" },
              {
                label: "Day Change",
                value: `${dayChange >= 0 ? "+" : ""}${formatINR(dayChange, true)}`,
                color: dayChange >= 0 ? "#16a34a" : "#dc2626",
              },
              {
                label: "Risk Score",
                value: `${riskScore.toFixed(1)} / 10`,
                color: riskScore < 4 ? "#16a34a" : riskScore < 7 ? "#f59e0b" : "#dc2626",
              },
              {
                label: "Diversification",
                value: `${diversificationScore.toFixed(0)}%`,
                color: "#0ea5e9",
              },
            ].map((s) => (
              <article
                key={s.label}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 6 }}>
                  {s.label}
                </p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: -0.5 }}>
                  {s.value}
                </p>
              </article>
            ))}
          </div>

          <div className="user-split-chart">
            <article style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Portfolio Value — 90 days
              </h3>
              <AreaChart
                data={chartData}
                color="#0ea5e9"
                height={240}
                valueFormatter={(n) => formatINR(n, true)}
              />
            </article>

            <article style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Sector Allocation
              </h3>
              {sectorTotal === 0 ? (
                <p
                  style={{
                    margin: 0,
                    height: 220,
                    display: "grid",
                    placeItems: "center",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  No sectors tagged.
                </p>
              ) : (
                <DonutChart
                  slices={sectorSlices}
                  centerLabel="Total"
                  centerValue={formatINR(sectorTotal, true)}
                  size={170}
                  thickness={26}
                />
              )}
            </article>
          </div>

          {/* Holdings table */}
          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Holdings ({holdings.length})
              </h3>
            </div>
            {holdings.length === 0 ? (
              <p style={{ margin: 0, padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                No holdings synced yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      {["Symbol", "Sector", "Qty", "Avg Price", "Current", "Value", "P&L", "P&L %"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: h === "Symbol" || h === "Sector" ? "left" : "right",
                              padding: "10px 18px",
                              fontWeight: 600,
                              fontSize: 10,
                              color: "var(--text-muted)",
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => {
                      const ap = Number(h.averagePrice);
                      const cp = Number(h.currentPrice ?? h.averagePrice);
                      const qty = Number(h.quantity);
                      const value = cp * qty;
                      const pnl = (cp - ap) * qty;
                      const pnlPct = ap > 0 ? ((cp - ap) / ap) * 100 : 0;
                      const positive = pnl >= 0;
                      const color = SYMBOL_COLORS[h.symbol] ?? "#64748b";
                      return (
                        <tr key={h.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "12px 18px" }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 7,
                                  background: color + "1a",
                                  color,
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 10,
                                  fontWeight: 800,
                                }}
                              >
                                {h.symbol.slice(0, 1)}
                              </div>
                              <strong>{h.symbol}</strong>
                            </div>
                          </td>
                          <td style={{ padding: "12px 18px", color: "var(--text-muted)" }}>
                            {h.sector ?? "—"}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right" }}>{qty}</td>
                          <td style={{ padding: "12px 18px", textAlign: "right" }}>
                            {formatINR(ap)}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right" }}>
                            {formatINR(cp)}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right", fontWeight: 600 }}>
                            {formatINR(value, true)}
                          </td>
                          <td
                            style={{
                              padding: "12px 18px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: positive ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {positive ? "+" : "−"}
                            {formatINR(Math.abs(pnl), true)}
                          </td>
                          <td
                            style={{
                              padding: "12px 18px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: positive ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {positive ? "+" : ""}
                            {pnlPct.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* ── Live Market Chart ── */}
          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 18,
              marginTop: 14,
            }}
          >
            <h3
              style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}
            >
              Live Chart — OHLCV
            </h3>
            <LiveCandleChart defaultSymbol="NIFTY 50" />
          </article>

          {/* ── Angel One Live Holdings ── */}
          {liveHoldings.length > 0 && (
            <article
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 0,
                overflow: "hidden",
                marginTop: 14,
              }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                  Angel One Holdings — Live ({liveHoldings.length})
                </h3>
                <span
                  style={{
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: "rgba(34,197,94,0.12)",
                    color: "#16a34a",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  LIVE
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      {["Symbol", "Qty", "Avg Price", "LTP", "P&L", "P&L %"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === "Symbol" ? "left" : "right",
                            padding: "10px 18px",
                            fontWeight: 600,
                            fontSize: 10,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.6,
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveHoldings.map((h) => {
                      const positive = h.profitandloss >= 0;
                      return (
                        <tr key={h.isin} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "12px 18px" }}>
                            <strong>{h.symbolname || h.tradingsymbol}</strong>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{h.exchange}</div>
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right" }}>
                            {h.quantity}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right" }}>
                            {formatINR(h.averageprice)}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right", fontWeight: 600 }}>
                            {formatINR(h.ltp)}
                          </td>
                          <td
                            style={{
                              padding: "12px 18px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: positive ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {positive ? "+" : ""}
                            {formatINR(h.profitandloss, true)}
                          </td>
                          <td
                            style={{
                              padding: "12px 18px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: positive ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {positive ? "+" : ""}
                            {h.pnlpercentage.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </>
      )}
    </section>
  );
}
