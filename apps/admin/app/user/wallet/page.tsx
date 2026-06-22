import Link from "next/link";
import { cookies } from "next/headers";
import { FiCreditCard, FiTrendingUp } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import WalletActions from "@/components/paper/wallet-actions";
import PaperTradeForm from "@/components/paper/paper-trade-form";
import {
  attachRealizedPnL,
  computePortfolioSummary,
  lastPricesFromTrades,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";

export const dynamic = "force-dynamic";

const INITIAL_BALANCE = 1_000_000;

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default async function WalletPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);

  const userId = auth?.userId ?? null;
  const wallet = userId
    ? await prisma.virtualWallet.findUnique({
        where: { userId },
        include: {
          trades: { orderBy: { tradedAt: "desc" } },
        },
      })
    : null;

  const allTrades: VirtualTradeRow[] =
    wallet?.trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side as "buy" | "sell",
      quantity: Number(t.quantity),
      price: Number(t.price),
      tradedAt: t.tradedAt,
    })) ?? [];

  const trades = allTrades.slice(0, 15);
  const priceBySymbol = lastPricesFromTrades(allTrades);

  const summary = wallet
    ? computePortfolioSummary(Number(wallet.balance), allTrades, priceBySymbol, INITIAL_BALANCE)
    : null;

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: -0.5 }}>
          Paper Wallet
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Demo funds only — add virtual balance and place paper trades
        </p>
      </div>

      {!isAuthed ? (
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 48,
            textAlign: "center",
          }}
        >
          <FiCreditCard size={36} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600 }}>Sign in for your paper wallet</h2>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-muted)" }}>
            Practice trading with virtual money — no broker account required.
          </p>
          <Link
            href="/register"
            style={{
              display: "inline-block",
              padding: "10px 22px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #0ea5e9, #16a34a)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Get started
          </Link>
        </article>
      ) : (
        <>
          <div className="user-stat-grid" style={{ marginBottom: 18 }}>
            {[
              {
                label: "Cash balance",
                value: formatINR(Number(wallet?.balance ?? 0)),
                color: "#0ea5e9",
              },
              {
                label: "Holdings value",
                value: formatINR(summary?.holdingsValue ?? 0),
                color: "#7c3aed",
              },
              {
                label: "Total equity",
                value: formatINR(summary?.totalEquity ?? Number(wallet?.balance ?? 0)),
                color: "var(--text)",
              },
              {
                label: "Total P&L",
                value: `${summary && summary.totalPnL >= 0 ? "+" : ""}${formatINR(summary?.totalPnL ?? 0)}`,
                color: (summary?.totalPnL ?? 0) >= 0 ? "#16a34a" : "#dc2626",
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
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{s.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: s.color }}>{s.value}</p>
              </article>
            ))}
          </div>

          <div className="user-split-2" style={{ marginBottom: 18 }}>
            <WalletActions hasWallet={Boolean(wallet)} balance={Number(wallet?.balance ?? 0)} />
            <article
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 20,
              }}
            >
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
                Quick paper trade
              </h2>
              <PaperTradeForm />
              <Link
                href="/user/markets"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#0ea5e9",
                  textDecoration: "none",
                }}
              >
                <FiTrendingUp size={14} /> Open markets terminal
              </Link>
            </article>
          </div>

          <article
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Recent activity</h3>
              <Link href="/user/history?type=virtual" style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9" }}>
                Full history →
              </Link>
            </div>
            {trades.length === 0 ? (
              <p style={{ margin: 0, padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No trades yet. Add funds and place your first paper trade.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      {["Symbol", "Side", "Qty", "Price", "Value", "P&L", "When"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "10px 18px",
                            fontSize: 10,
                            color: "var(--text-muted)",
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
                    {attachRealizedPnL(trades.map((t) => ({ ...t, id: t.id as number })))
                      .reverse()
                      .slice(0, 15)
                      .map((row) => (
                        <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "12px 18px", fontWeight: 700 }}>{row.symbol}</td>
                          <td style={{ padding: "12px 18px", textTransform: "uppercase", fontSize: 10, fontWeight: 700 }}>
                            {row.side}
                          </td>
                          <td style={{ padding: "12px 18px" }}>{row.quantity}</td>
                          <td style={{ padding: "12px 18px" }}>{formatINR(row.price)}</td>
                          <td style={{ padding: "12px 18px" }}>{formatINR(row.value)}</td>
                          <td
                            style={{
                              padding: "12px 18px",
                              fontWeight: 700,
                              color:
                                row.realizedPnL == null
                                  ? "var(--text-muted)"
                                  : row.realizedPnL >= 0
                                    ? "#16a34a"
                                    : "#dc2626",
                            }}
                          >
                            {row.realizedPnL != null
                              ? `${row.realizedPnL >= 0 ? "+" : ""}${formatINR(row.realizedPnL)}`
                              : "—"}
                          </td>
                          <td style={{ padding: "12px 18px", color: "var(--text-muted)", fontSize: 11 }}>
                            {row.tradedAt.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}
    </section>
  );
}
