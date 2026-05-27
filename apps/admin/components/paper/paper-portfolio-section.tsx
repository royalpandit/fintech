import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  computePortfolioSummary,
  computePositions,
  lastPricesFromTrades,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";
import PaperTradeForm from "./paper-trade-form";

const INITIAL_BALANCE = 1_000_000;

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default async function PaperPortfolioSection({ userId }: { userId: number }) {
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
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Paper portfolio</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.85 }}>
          Create a virtual wallet to hold demo stocks and options.
        </p>
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
      </article>
    );
  }

  const trades: VirtualTradeRow[] = wallet.trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "buy" | "sell",
    quantity: Number(t.quantity),
    price: Number(t.price),
    tradedAt: t.tradedAt,
  }));

  const priceBySymbol = lastPricesFromTrades(trades);
  const summary = computePortfolioSummary(
    Number(wallet.balance),
    trades,
    priceBySymbol,
    INITIAL_BALANCE,
  );
  const positions = computePositions(trades, priceBySymbol);

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
          <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
            Virtual holdings
          </h2>
        </div>
        <Link href="/user/wallet" style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9" }}>
          Wallet →
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          { label: "Cash", value: formatINR(summary.cashBalance), color: "#0ea5e9" },
          { label: "Invested", value: formatINR(summary.investedCost), color: "#64748b" },
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
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>{s.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</p>
          </article>
        ))}
      </div>

      <article
        style={{
          background: "#fff",
          border: "1px solid #eef0f4",
          borderRadius: 14,
          padding: 0,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        {positions.length === 0 ? (
          <p style={{ margin: 0, padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            No open positions. Buy stocks or options from Markets or use the form below.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Symbol", "Qty", "Avg cost", "LTP", "Value", "P&L", "P&L %"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 16px",
                        fontSize: 10,
                        color: "#64748b",
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.symbol} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 800 }}>{p.symbol}</td>
                    <td style={{ padding: "12px 16px" }}>{p.quantity}</td>
                    <td style={{ padding: "12px 16px" }}>{formatINR(p.avgPrice)}</td>
                    <td style={{ padding: "12px 16px" }}>{formatINR(p.lastPrice)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{formatINR(p.marketValue)}</td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 700,
                        color: p.unrealizedPnL >= 0 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {p.unrealizedPnL >= 0 ? "+" : ""}
                      {formatINR(p.unrealizedPnL)}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 700,
                        color: p.unrealizedPnLPct >= 0 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {p.unrealizedPnLPct >= 0 ? "+" : ""}
                      {p.unrealizedPnLPct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article
        style={{
          background: "#fff",
          border: "1px solid #eef0f4",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>Place paper trade</h3>
        <PaperTradeForm compact />
      </article>
    </div>
  );
}
