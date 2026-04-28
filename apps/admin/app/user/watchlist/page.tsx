import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";

export const dynamic = "force-dynamic";

const SYMBOL_COLORS: Record<string, string> = {
  AAPL: "#0f172a",
  RELIANCE: "#0ea5e9",
  TCS: "#7c3aed",
  INFY: "#10b981",
  HDFCBANK: "#dc2626",
  ICICIBANK: "#f59e0b",
};

export default async function WatchlistPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);

  // Build a personalized watchlist from symbols mentioned in posts the user has
  // engaged with (likes/comments). Falls back to trending platform symbols.
  const userId = auth?.userId ?? null;

  const [trendingSymbols, recentReactions] = await Promise.all([
    prisma.marketPost.groupBy({
      by: ["marketSymbol"],
      where: {
        complianceStatus: "approved",
        deletedAt: null,
        marketSymbol: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 12,
    }),
    userId
      ? prisma.marketReaction.findMany({
          where: { userId, type: "like" },
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { post: { select: { marketSymbol: true, sentiment: true } } },
        })
      : Promise.resolve([]),
  ]);

  // Aggregate user's symbols of interest
  const userSymbolMap = new Map<string, { symbol: string; bullish: number; bearish: number }>();
  for (const r of recentReactions) {
    if (!r.post.marketSymbol) continue;
    const cur = userSymbolMap.get(r.post.marketSymbol) ?? {
      symbol: r.post.marketSymbol,
      bullish: 0,
      bearish: 0,
    };
    if (r.post.sentiment === "bullish") cur.bullish++;
    if (r.post.sentiment === "bearish") cur.bearish++;
    userSymbolMap.set(r.post.marketSymbol, cur);
  }

  const sourceSymbols =
    userSymbolMap.size > 0
      ? Array.from(userSymbolMap.values())
      : trendingSymbols.slice(0, 8).map((s) => ({
          symbol: s.marketSymbol ?? "—",
          bullish: 0,
          bearish: 0,
        }));

  // Synthetic price/change for visual richness (no live feed yet)
  const watchlistRows = sourceSymbols.map((row) => {
    const seed = row.symbol.charCodeAt(0) + row.symbol.charCodeAt(1 % row.symbol.length);
    const price = 1000 + (seed % 4000);
    const change = ((seed % 100) - 50) / 25;
    const volume = 50000 + (seed % 250000);
    return {
      symbol: row.symbol,
      company:
        row.symbol === "AAPL"
          ? "Apple Inc."
          : row.symbol === "RELIANCE"
            ? "Reliance Ind."
            : row.symbol === "TCS"
              ? "Tata Cons. Svcs."
              : row.symbol === "INFY"
                ? "Infosys Ltd."
                : row.symbol === "HDFCBANK"
                  ? "HDFC Bank"
                  : row.symbol === "ICICIBANK"
                    ? "ICICI Bank"
                    : row.symbol,
      price,
      change,
      volume,
      bullish: row.bullish,
      bearish: row.bearish,
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
          {userSymbolMap.size > 0
            ? `${userSymbolMap.size} symbols you've engaged with`
            : "Trending symbols on Corescent"}
        </p>
      </div>

      {!isAuthed && (
        <article
          style={{
            background: "linear-gradient(135deg, #f0fdf4, #ecfeff)",
            border: "1px solid #bbf7d0",
            borderRadius: 14,
            padding: 18,
            marginBottom: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              Build a personalized watchlist
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
              Sign up to save symbols, get advisor sentiment alerts, and track your watchlist.
            </p>
          </div>
          <Link
            href="/register"
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #0ea5e9, #16a34a)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Get started
          </Link>
        </article>
      )}

      <article
        style={{
          background: "#fff",
          border: "1px solid #eef0f4",
          borderRadius: 14,
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Symbol", "Price", "Change", "Volume", "Advisor View", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign:
                        h === "Symbol" || h === "Advisor View" ? "left" : "right",
                      padding: "12px 18px",
                      fontWeight: 600,
                      fontSize: 10,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      borderBottom: "1px solid #eef0f4",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {watchlistRows.map((row) => {
                const positive = row.change >= 0;
                const color = SYMBOL_COLORS[row.symbol] ?? "#64748b";
                const dominantSentiment =
                  row.bullish > row.bearish
                    ? "Bullish"
                    : row.bearish > row.bullish
                      ? "Bearish"
                      : "Neutral";
                const sentColor =
                  dominantSentiment === "Bullish"
                    ? "#16a34a"
                    : dominantSentiment === "Bearish"
                      ? "#dc2626"
                      : "#64748b";
                return (
                  <tr key={row.symbol} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: color + "1a",
                            color,
                            display: "grid",
                            placeItems: "center",
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {row.symbol.slice(0, 1)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                            {row.symbol}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>{row.company}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700 }}>
                      ₹{row.price.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: "14px 18px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: positive ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {positive ? "+" : ""}
                      {row.change.toFixed(2)}%
                    </td>
                    <td
                      style={{ padding: "14px 18px", textAlign: "right", color: "#64748b" }}
                    >
                      {(row.volume / 1000).toFixed(0)}k
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      {row.bullish > 0 || row.bearish > 0 ? (
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${sentColor}1a`,
                            color: sentColor,
                          }}
                        >
                          {dominantSentiment} ({row.bullish + row.bearish})
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>No advisor posts</span>
                      )}
                    </td>
                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <AuthGate
                        isAuthenticated={isAuthed}
                        promptTitle="Sign in to trade"
                        promptDescription="Open Virtual Lab to trade this symbol with practice money."
                      >
                        <button
                          type="button"
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            background: "rgba(14,165,233,0.08)",
                            color: "#0ea5e9",
                            fontSize: 11,
                            fontWeight: 700,
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Trade
                        </button>
                      </AuthGate>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
