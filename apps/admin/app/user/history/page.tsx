import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { FiClock } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import HistoryFilters from "@/components/paper/history-filters";
import {
  attachRealizedPnL,
  computePortfolioSummary,
  filterTradesByPeriod,
  lastPricesFromTrades,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";

export const dynamic = "force-dynamic";

const INITIAL_BALANCE = 1_000_000;

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function relTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

type SearchParams = {
  type?: string;
  month?: string;
  from?: string;
  to?: string;
};

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  const filter = searchParams.type ?? "virtual";
  const month = searchParams.month;
  const fromStr = searchParams.from;
  const toStr = searchParams.to;

  const [virtualTradesRaw, realTrades, virtualWallet] = await Promise.all([
    userId
      ? prisma.tradeVirtual.findMany({
          where: { wallet: { userId } },
          orderBy: { tradedAt: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    userId
      ? prisma.tradeReal.findMany({
          where: { portfolio: { userId } },
          orderBy: { tradedAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    userId
      ? prisma.virtualWallet.findUnique({
          where: { userId },
          include: { trades: { orderBy: { tradedAt: "asc" } } },
        })
      : Promise.resolve(null),
  ]);

  let virtualRows: VirtualTradeRow[] = virtualTradesRaw.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "buy" | "sell",
    quantity: Number(t.quantity),
    price: Number(t.price),
    tradedAt: t.tradedAt,
  }));

  virtualRows = filterTradesByPeriod(virtualRows, {
    month,
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr + "T23:59:59") : undefined,
  });

  const virtualWithPnL = attachRealizedPnL(
    virtualRows.map((t) => ({ ...t, id: t.id as number })),
  ).reverse();

  type Row = {
    id: string;
    kind: "virtual" | "real";
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    value: number;
    realizedPnL: number | null;
    fees?: number;
    at: Date;
  };

  const all: Row[] = [
    ...virtualWithPnL.map((t) => ({
      id: `v-${t.id}`,
      kind: "virtual" as const,
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
      value: t.value,
      realizedPnL: t.realizedPnL,
      at: t.tradedAt,
    })),
    ...realTrades.map((t) => ({
      id: `r-${t.id}`,
      kind: "real" as const,
      symbol: t.symbol,
      side: t.side as "buy" | "sell",
      quantity: Number(t.quantity),
      price: Number(t.price),
      value: Number(t.price) * Number(t.quantity),
      realizedPnL: null,
      fees: Number(t.fees),
      at: t.tradedAt,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const filtered =
    filter === "virtual"
      ? all.filter((r) => r.kind === "virtual")
      : filter === "real"
        ? all.filter((r) => r.kind === "real")
        : all;

  const allVirtualTrades: VirtualTradeRow[] =
    virtualWallet?.trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side as "buy" | "sell",
      quantity: Number(t.quantity),
      price: Number(t.price),
      tradedAt: t.tradedAt,
    })) ?? [];

  const summary = virtualWallet
    ? computePortfolioSummary(
        Number(virtualWallet.balance),
        allVirtualTrades,
        lastPricesFromTrades(allVirtualTrades),
        INITIAL_BALANCE,
      )
    : null;

  const periodRealized = virtualWithPnL
    .filter((t) => t.side === "sell" && t.realizedPnL != null)
    .reduce((s, t) => s + (t.realizedPnL ?? 0), 0);

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
          Trade History
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          {isAuthed
            ? "Paper trades with per-trade P&L · filter by date or month"
            : "Sign up to track every paper and broker trade"}
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
          <div style={{ fontSize: 36, marginBottom: 12, color: "var(--text-muted)", display: "flex", justifyContent: "center" }}>
            <FiClock size={36} />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
            Sign in to see your trade history
          </h2>
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
              { label: "Trades (view)", value: filtered.length.toLocaleString(), color: "var(--text)" },
              {
                label: "Total P&L (all time)",
                value: `${summary && summary.totalPnL >= 0 ? "+" : ""}${formatINR(summary?.totalPnL ?? 0)}`,
                color: (summary?.totalPnL ?? 0) >= 0 ? "#16a34a" : "#dc2626",
              },
              {
                label: "Realized (period)",
                value: `${periodRealized >= 0 ? "+" : ""}${formatINR(periodRealized)}`,
                color: periodRealized >= 0 ? "#16a34a" : "#dc2626",
              },
              {
                label: "Wallet balance",
                value: formatINR(Number(virtualWallet?.balance ?? 0)),
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
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{s.label}</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</p>
              </article>
            ))}
          </div>

          <Suspense fallback={null}>
            <HistoryFilters />
          </Suspense>

          <article
            className="user-page-table-wrap"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 0,
              overflow: "hidden",
            }}
          >
            {filtered.length === 0 ? (
              <p style={{ margin: 0, padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No trades match these filters.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      {["Type", "Date", "Symbol", "Side", "Qty", "Price", "Value", "P&L", "When"].map((h) => (
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
                    {filtered.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 18px" }}>
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 700,
                              background: row.kind === "virtual" ? "#dbeafe" : "#d1fae5",
                              color: row.kind === "virtual" ? "#1e40af" : "#047857",
                            }}
                          >
                            {row.kind}
                          </span>
                        </td>
                        <td style={{ padding: "12px 18px", fontSize: 11, color: "var(--text-muted)" }}>
                          {row.at.toLocaleDateString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 18px", fontWeight: 700 }}>{row.symbol}</td>
                        <td style={{ padding: "12px 18px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 700,
                              background: row.side === "buy" ? "#d1fae5" : "#fee2e2",
                              color: row.side === "buy" ? "#047857" : "#991b1b",
                            }}
                          >
                            {row.side}
                          </span>
                        </td>
                        <td style={{ padding: "12px 18px" }}>{row.quantity}</td>
                        <td style={{ padding: "12px 18px" }}>{formatINR(row.price)}</td>
                        <td style={{ padding: "12px 18px", fontWeight: 600 }}>{formatINR(row.value)}</td>
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
                          {row.kind === "virtual" && row.realizedPnL != null
                            ? `${row.realizedPnL >= 0 ? "+" : ""}${formatINR(row.realizedPnL)}`
                            : "—"}
                        </td>
                        <td style={{ padding: "12px 18px", color: "var(--text-muted)", fontSize: 11 }}>
                          {relTime(row.at)}
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
