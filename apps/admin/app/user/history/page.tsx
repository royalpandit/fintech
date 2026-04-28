import Link from "next/link";
import { cookies } from "next/headers";
import { FiClock } from "react-icons/fi";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

type SearchParams = { type?: string };

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  const filter = searchParams.type ?? "all";

  const [virtualTrades, realTrades, virtualWallet] = await Promise.all([
    userId
      ? prisma.tradeVirtual.findMany({
          where: { wallet: { userId } },
          orderBy: { tradedAt: "desc" },
          take: 100,
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
      ? prisma.virtualWallet.findUnique({ where: { userId } })
      : Promise.resolve(null),
  ]);

  type Row = {
    id: string;
    kind: "virtual" | "real";
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    fees?: number;
    at: Date;
  };

  const all: Row[] = [
    ...virtualTrades.map((t) => ({
      id: `v-${t.id}`,
      kind: "virtual" as const,
      symbol: t.symbol,
      side: t.side as "buy" | "sell",
      quantity: Number(t.quantity),
      price: Number(t.price),
      at: t.tradedAt,
    })),
    ...realTrades.map((t) => ({
      id: `r-${t.id}`,
      kind: "real" as const,
      symbol: t.symbol,
      side: t.side as "buy" | "sell",
      quantity: Number(t.quantity),
      price: Number(t.price),
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

  const totalVirtualVolume = virtualTrades.reduce(
    (s, t) => s + Number(t.price) * Number(t.quantity),
    0,
  );
  const totalRealVolume = realTrades.reduce(
    (s, t) => s + Number(t.price) * Number(t.quantity),
    0,
  );

  const tabs = [
    { key: "all", label: `All (${all.length})` },
    { key: "virtual", label: `Virtual (${virtualTrades.length})` },
    { key: "real", label: `Real (${realTrades.length})` },
  ];

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
          Trade History
        </h1>
        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>
          {isAuthed
            ? `${all.length} total trades — virtual + real`
            : "Sign up to track every trade across virtual lab and real broker accounts"}
        </p>
      </div>

      {!isAuthed ? (
        <article
          style={{
            background: "#fff",
            border: "1px solid #eef0f4",
            borderRadius: 14,
            padding: 48,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12, color: "#94a3b8", display: "flex", justifyContent: "center" }}>
            <FiClock size={36} />
          </div>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 18,
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Sign in to see your trade history
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b" }}>
            All your virtual lab trades and connected broker trades appear here.
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
            Get started — free
          </Link>
        </article>
      ) : (
        <>
          {/* Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {[
              { label: "Total Trades", value: all.length.toLocaleString(), color: "#0f172a" },
              {
                label: "Virtual Volume",
                value: formatINR(totalVirtualVolume),
                color: "#0ea5e9",
              },
              { label: "Real Volume", value: formatINR(totalRealVolume), color: "#10b981" },
              {
                label: "Lab Balance",
                value: formatINR(Number(virtualWallet?.balance ?? 0)),
                color: "#f59e0b",
              },
            ].map((s) => (
              <article
                key={s.label}
                style={{
                  background: "#fff",
                  border: "1px solid #eef0f4",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: "#64748b",
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  {s.label}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 800,
                    color: s.color,
                    letterSpacing: -0.5,
                  }}
                >
                  {s.value}
                </p>
              </article>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.key === "all" ? "/user/history" : `/user/history?type=${t.key}`}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: filter === t.key ? "#fff" : "#64748b",
                  background: filter === t.key ? "#0ea5e9" : "#fff",
                  border: "1px solid #eef0f4",
                  textDecoration: "none",
                }}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {/* Table */}
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 0,
              overflow: "hidden",
            }}
          >
            {filtered.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: 48,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 13,
                }}
              >
                No trades in this view yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Type", "Symbol", "Side", "Qty", "Price", "Value", "When"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "10px 18px",
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
                    {filtered.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 18px" }}>
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 700,
                              background: row.kind === "virtual" ? "#dbeafe" : "#d1fae5",
                              color: row.kind === "virtual" ? "#1e40af" : "#047857",
                              textTransform: "uppercase",
                            }}
                          >
                            {row.kind}
                          </span>
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
                              textTransform: "uppercase",
                            }}
                          >
                            {row.side}
                          </span>
                        </td>
                        <td style={{ padding: "12px 18px" }}>{row.quantity}</td>
                        <td style={{ padding: "12px 18px" }}>{formatINR(row.price)}</td>
                        <td style={{ padding: "12px 18px", fontWeight: 600 }}>
                          {formatINR(row.price * row.quantity)}
                        </td>
                        <td style={{ padding: "12px 18px", color: "#64748b", fontSize: 11 }}>
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
