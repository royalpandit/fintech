import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadPortfolioOverview } from "@/lib/portfolio-overview";
import PaperTradeForm from "./paper-trade-form";

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Paper holdings + P&L.
 *
 * `showTradeForm` exists because this section embedded its own "Place paper
 * trade" form, and both /user/portfolio and /user/virtual-trading render the
 * section — so Virtual Trading showed the form twice (once in its own Quick
 * trade card, once in here) and the two pages looked like the same screen.
 * Trading now lives on Virtual Trading; Portfolio is for reviewing positions.
 */
export default async function PaperPortfolioSection({
  userId,
  showTradeForm = true,
  basePath = "/user/portfolio",
}: {
  userId: number;
  showTradeForm?: boolean;
  /**
   * Where a position row links to.
   *
   * The advisor console renders this same component, and app/user/layout.tsx
   * redirects advisors out of /user/* by role — so a hardcoded /user/portfolio
   * link would bounce every advisor straight back to their own dashboard. Same
   * trap the Buy/Sell buttons fell into.
   */
  basePath?: string;
}) {
  const wallet = await prisma.virtualWallet.findUnique({
    where: { userId },
    include: { trades: { orderBy: { tradedAt: "asc" } } },
  });

  if (!wallet) {
    return (
      <article
        style={{
          background: "linear-gradient(135deg, #0f172a, #0c4a6e)",
          color: "#fff",
          borderRadius: 14,
          padding: 24,
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600 }}>Paper portfolio</h2>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>
          No virtual holdings yet.
        </p>
        {/* Wallet is hidden from the nav, so the "Set up paper wallet →" CTA
            that used to sit here would have pointed at a page the user can no
            longer reach. Restore it alongside the Wallet nav item.
        <Link
          href="/user/wallet"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: 10,
            background: "#0ea5e9",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          Set up paper wallet →
        </Link>
        */}
      </article>
    );
  }

  /*
   * Priced at the market, not at cost.
   *
   * This used to pass lastPricesFromTrades straight in — the price each
   * position was BOUGHT at — so LTP always equalled average cost and every
   * position showed exactly ₹0 unrealised P&L for ever, however the market
   * moved. loadPortfolioOverview fetches live quotes (Dhan, then Yahoo, then
   * cost as a last resort) and derives the same summary from them.
   */
  const overview = await loadPortfolioOverview(userId);
  const positions = overview?.positions ?? [];
  const summary = {
    cashBalance: overview?.cashBalance ?? Number(wallet.balance),
    investedCost: overview?.investedCost ?? 0,
    holdingsValue: overview?.holdingsValue ?? 0,
    totalEquity: overview?.totalEquity ?? Number(wallet.balance),
    unrealizedPnL: overview?.unrealizedPnL ?? 0,
    realizedPnL: overview?.realizedPnL ?? 0,
    totalPnL: overview?.totalPnL ?? 0,
    totalPnLPct: overview?.totalPnLPct ?? 0,
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 12,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#0ea5e9",
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Paper trading
          </span>
          <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>
            Virtual holdings
          </h2>
        </div>
        {/* Wallet tab is commented out of the nav — restore this link with it.
        <Link href="/user/wallet" style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9" }}>
          Wallet →
        </Link>
        */}
      </div>

      {/* Four cards, not five: Cash is the virtual wallet balance, and with the
          Wallet tab hidden there is nowhere to see or top up that number — so
          it read as an unexplained figure. Restore the Cash entry below and
          switch the class back to user-stat-grid-5 together. */}
      <div
        className="user-stat-grid"
        style={{ marginBottom: 14 }}
      >
        {[
          // { label: "Cash", value: formatINR(summary.cashBalance), color: "#0ea5e9" },
          { label: "Invested", value: formatINR(summary.investedCost), color: "var(--text-muted)" },
          { label: "Holdings", value: formatINR(summary.holdingsValue), color: "#7c3aed" },
          {
            label: "Unrealized P&L",
            value: `${summary.unrealizedPnL >= 0 ? "+" : ""}${formatINR(summary.unrealizedPnL)}`,
            color: summary.unrealizedPnL >= 0 ? "#16a34a" : "#dc2626",
          },
          {
            label: "Total P&L",
            value: `${summary.totalPnL >= 0 ? "+" : ""}${formatINR(summary.totalPnL)} (${summary.totalPnLPct.toFixed(2)}%)`,
            color: summary.totalPnL >= 0 ? "#16a34a" : "#dc2626",
          },
        ].map((s) => (
          <article
            key={s.label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>{s.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: s.color }}>{s.value}</p>
          </article>
        ))}
      </div>

      <article
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 0,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        {positions.length === 0 ? (
          <p style={{ margin: 0, padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No open positions yet.
          </p>
        ) : (
          /* Rows link through to the holding's own page. The whole row is the
             target rather than just the symbol: a 12px ticker is a poor hit
             area, and on a phone it is close to unusable. */
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  {["Symbol", "Qty", "Avg cost", "LTP", "Value", "P&L", "P&L %"].map((h, i) => (
                    <th key={h} className={i === 0 ? undefined : "num"}>
                      {h}
                    </th>
                  ))}
                  <th aria-label="Open holding" />
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const up = p.unrealizedPnL >= 0;
                  return (
                    <tr key={p.symbol} className="pp-row">
                      <td>
                        <Link href={`${basePath}/${encodeURIComponent(p.symbol)}`} className="pp-row-link">
                          {p.symbol}
                        </Link>
                      </td>
                      <td className="num">{p.quantity}</td>
                      <td className="num">{formatINR(p.avgPrice)}</td>
                      <td className="num">{formatINR(p.lastPrice)}</td>
                      <td className="num strong">{formatINR(p.marketValue)}</td>
                      <td className={`num strong ${up ? "up" : "down"}`}>
                        {up ? "+" : ""}
                        {formatINR(p.unrealizedPnL)}
                      </td>
                      <td className={`num strong ${up ? "up" : "down"}`}>
                        {up ? "+" : ""}
                        {p.unrealizedPnLPct.toFixed(2)}%
                      </td>
                      <td className="pp-row-chev" aria-hidden>
                        ›
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {showTradeForm && (
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>Place paper trade</h3>
          <PaperTradeForm compact />
        </article>
      )}
    </div>
  );
}
