import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import WatchlistEditor from "@/components/paper/watchlist-editor";
import { lastPricesFromTrades } from "@/lib/virtual-trading";

export const dynamic = "force-dynamic";

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default async function WatchlistPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  const [watchlist, wallet] = await Promise.all([
    userId
      ? prisma.watchlist.findFirst({
          where: { userId },
          include: { items: { orderBy: { addedAt: "desc" } } },
        })
      : Promise.resolve(null),
    userId
      ? prisma.virtualWallet.findUnique({
          where: { userId },
          include: { trades: { orderBy: { tradedAt: "asc" } } },
        })
      : Promise.resolve(null),
  ]);

  const items = watchlist?.items ?? [];
  const lastPrices = wallet
    ? lastPricesFromTrades(
        wallet.trades.map((t) => ({
          symbol: t.symbol,
          side: t.side as "buy" | "sell",
          quantity: Number(t.quantity),
          price: Number(t.price),
          tradedAt: t.tradedAt,
        })),
      )
    : {};

  const watchlistRows = items.map((item) => {
    const sym = item.symbol.toUpperCase();
    const price = lastPrices[sym] ?? 1000 + (sym.charCodeAt(0) % 3000);
    const change = ((sym.charCodeAt(1) ?? 0) % 20) - 10;
    return {
      id: item.id,
      symbol: sym,
      assetType: item.assetType,
      price,
      change,
      notes: item.notes,
    };
  });

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: -0.5,
          }}
        >
          Watchlist
        </h1>
        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
          {isAuthed
            ? `${items.length} symbol${items.length !== 1 ? "s" : ""} — stocks & options you track`
            : "Sign in to save your watchlist"}
        </p>
      </div>

      {isAuthed ? (
        <>
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <WatchlistEditor
              initialItems={items.map((i) => ({
                id: i.id,
                symbol: i.symbol,
                asset_type: i.assetType,
                notes: i.notes,
              }))}
            />
          </article>

          <article
            className="user-page-table-wrap"
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 0,
              overflow: "hidden",
            }}
          >
            {watchlistRows.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: 48,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 13,
                }}
              >
                Add symbols above, or browse{" "}
                <Link href="/user/markets" style={{ color: "#0ea5e9", fontWeight: 700 }}>
                  Markets
                </Link>{" "}
                to research instruments.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Symbol", "Type", "LTP / ref.", "Change", "Actions"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "10px 18px",
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
                    {watchlistRows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 18px", fontWeight: 800, fontSize: 14 }}>
                          {row.symbol}
                        </td>
                        <td style={{ padding: "14px 18px", textTransform: "capitalize", color: "#64748b" }}>
                          {row.assetType}
                        </td>
                        <td style={{ padding: "14px 18px", fontWeight: 600 }}>{formatINR(row.price)}</td>
                        <td
                          style={{
                            padding: "14px 18px",
                            fontWeight: 700,
                            color: row.change >= 0 ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {row.change >= 0 ? "+" : ""}
                          {row.change.toFixed(2)}%
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <Link
                            href={`/user/markets?symbol=${encodeURIComponent(row.symbol)}`}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              background: "#0ea5e9",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 11,
                              textDecoration: "none",
                              marginRight: 8,
                            }}
                          >
                            Trade
                          </Link>
                          <Link
                            href={`/user/wallet`}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "1px solid #eef0f4",
                              color: "#475569",
                              fontWeight: 600,
                              fontSize: 11,
                              textDecoration: "none",
                            }}
                          >
                            Paper buy
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      ) : (
        <AuthGate
          isAuthenticated={false}
          promptTitle="Sign in to save your watchlist"
          promptDescription="Track stocks and options you care about and trade them in the paper wallet."
        >
          <span />
        </AuthGate>
      )}
    </section>
  );
}
