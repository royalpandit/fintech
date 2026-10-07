import type { ComponentType } from "react";
import { cookies } from "next/headers";
import {
  FiBriefcase,
  FiLock,
  FiBarChart2,
  FiTarget,
  FiTrendingUp,
  FiLink,
} from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import ConnectBrokerButton from "@/components/portfolio/connect-broker-button";
import AreaChart from "@/components/advisor-ui/area-chart";
import { getHoldings } from "@/lib/dhan";

export const dynamic = "force-dynamic";

/*
 * Portfolio is the connected broker's book and nothing else.
 *
 * It used to blend the paper book in — paper positions in the holdings table,
 * paper value in the totals, paper sectors in the allocation donut — so a user
 * with no broker still saw a populated "portfolio" made of simulated trades.
 * Virtual money and real money reading as one balance is the wrong thing to
 * show on the page someone checks to see what they own.
 *
 * So: no broker, one card asking them to connect one. Broker connected, their
 * real holdings. The paper book and its sector donut live on Virtual Trading,
 * which is where that money is.
 */

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
      getHoldings().catch(() => [] as Awaited<ReturnType<typeof getHoldings>>),
    ]);

  /*
   * A linked account is the signal, not a synced portfolio row. The sync runs
   * after the link, so gating on the row would show the connect card again to
   * someone who had just connected.
   */
  const hasBroker = brokerAccounts.length > 0 || liveHoldings.length > 0;

  const activePortfolio = portfolios[0];
  const totalValue = activePortfolio ? Number(activePortfolio.totalValue) : 0;
  const dayChange = activePortfolio ? Number(activePortfolio.dayChange) : 0;

  // Cost and P&L off the synced holdings, so the strip always agrees with the
  // table under it rather than with a separately stored figure.
  let investedCost = 0;
  let unrealisedPnL = 0;
  for (const h of holdings) {
    const avg = Number(h.averagePrice);
    const cur = Number(h.currentPrice ?? h.averagePrice);
    const qty = Number(h.quantity);
    investedCost += avg * qty;
    unrealisedPnL += (cur - avg) * qty;
  }

  const chartData = snapshots.map((s) => ({
    label: dayLabel(s.day),
    value: Number(s.totalValue),
  }));

  return (
    <section>
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: -0.5,
            }}
          >
            Portfolio
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            {hasBroker
              ? "Holdings synced from your connected broker"
              : "Connect a broker to see your real holdings here"}
          </p>
        </div>
        {hasBroker && (
          <ConnectBrokerButton
            label="Manage brokers"
            connectedBrokers={brokerAccounts.map((b) => b.brokerName)}
          />
        )}
      </div>

      {!hasBroker ? (
        <article
          style={{
            background: "linear-gradient(135deg, #0f172a, #064e3b)",
            color: "#fff",
            borderRadius: 18,
            padding: 36,
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
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: -0.6 }}>
              Connect your broker to see your portfolio
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
              Link Dhan, Angel One or any supported broker and your real holdings,
              cost basis and P&amp;L appear here. Read-only — we never place orders.
            </p>
            <AuthGate
              isAuthenticated={isAuthed}
              promptTitle="Sign in to connect"
              promptDescription="Sign up to securely link your broker account."
            >
              <ConnectBrokerButton
                label={isAuthed ? "Connect Broker" : "Get started — free"}
                connectedBrokers={brokerAccounts.map((b) => b.brokerName)}
              />
            </AuthGate>
            <p style={{ margin: "14px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
              Practising with virtual money? That book lives in Virtual Trading.
            </p>
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
          <div className="user-stat-grid" style={{ marginBottom: 18 }}>
            {[
              { label: "Total Value", value: formatINR(totalValue, true), color: "var(--text)" },
              {
                label: "Day Change",
                value: `${dayChange >= 0 ? "+" : ""}${formatINR(dayChange, true)}`,
                color: dayChange >= 0 ? "#16a34a" : "#dc2626",
              },
              { label: "Invested", value: formatINR(investedCost, true), color: "var(--text)" },
              {
                label: "Unrealised P&L",
                value: `${unrealisedPnL >= 0 ? "+" : ""}${formatINR(unrealisedPnL, true)}`,
                color: unrealisedPnL >= 0 ? "#16a34a" : "#dc2626",
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
                <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: s.color, letterSpacing: -0.5 }}>
                  {s.value}
                </p>
              </article>
            ))}
          </div>

          {chartData.length > 0 && (
            <article
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 18,
                marginBottom: 18,
              }}
            >
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
          )}

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
                Broker Holdings ({holdings.length})
              </h3>
            </div>
            {holdings.length === 0 ? (
              <div className="brk-empty">
                <span className="brk-empty-icon" aria-hidden>
                  <FiLink size={22} />
                </span>
                <h4 className="brk-empty-title">Nothing synced yet</h4>
                <p className="brk-empty-text">
                  Your broker is linked. Holdings appear here once the first sync
                  completes.
                </p>
              </div>
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
                                  borderRadius: 8,
                                  background: color,
                                  color: "#fff",
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {h.symbol.slice(0, 2)}
                              </div>
                              <span style={{ fontWeight: 700, color: "var(--text)" }}>{h.symbol}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 18px", color: "var(--text-muted)" }}>
                            {h.sector ?? "—"}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right", color: "var(--text)" }}>
                            {qty}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right", color: "var(--text)" }}>
                            {formatINR(ap)}
                          </td>
                          <td style={{ padding: "12px 18px", textAlign: "right", color: "var(--text)" }}>
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

          {/* Live from the broker, alongside whatever the last sync wrote. */}
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
                  Live Holdings ({liveHoldings.length})
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
                          <td style={{ padding: "12px 18px", textAlign: "right" }}>{h.quantity}</td>
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
