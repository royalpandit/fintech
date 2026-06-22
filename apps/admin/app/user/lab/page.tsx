import Link from "next/link";
import { cookies } from "next/headers";
import { FiAward } from "react-icons/fi";
import { TbFlask } from "react-icons/tb";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import AuthGate from "@/components/auth-gate";
import AreaChart from "@/components/advisor-ui/area-chart";
import PaperTradeForm from "@/components/paper/paper-trade-form";
import {
  computePortfolioSummary,
  lastPricesFromTrades,
  type VirtualTradeRow,
} from "@/lib/virtual-trading";

type AgentRow = { id: number; name: string; description: string; avatar: string; model: string };

const INITIAL_BALANCE = 1_000_000;

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

export default async function VirtualLabPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const isAuthed = Boolean(auth);
  const userId = auth?.userId ?? null;

  const [wallet, trades, allTradesAsc, leaderboard, agents] = await Promise.all([
    userId ? prisma.virtualWallet.findUnique({ where: { userId } }) : Promise.resolve(null),
    userId
      ? prisma.tradeVirtual.findMany({
          where: { wallet: { userId } },
          orderBy: { tradedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    userId
      ? prisma.tradeVirtual.findMany({
          where: { wallet: { userId } },
          orderBy: { tradedAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.leaderboardEntry.findMany({
      orderBy: { roiPct: "desc" },
      take: 10,
      include: { user: { select: { id: true, fullName: true } } },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((prisma as any).geminiAgent?.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true, avatar: true, model: true },
      orderBy: { createdAt: "asc" },
    }) as Promise<AgentRow[]> | undefined)?.catch(() => []) ?? Promise.resolve([] as AgentRow[]),
  ]);

  const balance = wallet?.balance ? Number(wallet.balance) : 0;

  const tradeRows: VirtualTradeRow[] = allTradesAsc.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "buy" | "sell",
    quantity: Number(t.quantity),
    price: Number(t.price),
    tradedAt: t.tradedAt,
  }));
  const summary = wallet
    ? computePortfolioSummary(
        balance,
        tradeRows,
        lastPricesFromTrades(tradeRows),
        INITIAL_BALANCE,
      )
    : null;
  const pnlLabel =
    summary != null
      ? `${summary.totalPnL >= 0 ? "+" : ""}${formatINR(summary.totalPnL, true)}`
      : "+₹0";

  // Generate a synthetic 14-day curve based on trades for visualization
  const tradesByDay = new Map<string, number>();
  for (const t of trades) {
    const k = t.tradedAt.toISOString().slice(0, 10);
    const value =
      Number(t.price) * Number(t.quantity) * (t.side === "buy" ? -1 : 1);
    tradesByDay.set(k, (tradesByDay.get(k) ?? 0) + value);
  }
  const chartData: Array<{ label: string; value: number }> = [];
  let runningBalance = 1000000; // ₹10L starting capital
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    runningBalance += tradesByDay.get(k) ?? 0;
    chartData.push({ label: dayLabel(d), value: runningBalance });
  }

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: -0.5,
          }}
        >
          Virtual Investment Lab
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Practice trading with ₹10L of virtual capital. Risk-free.
        </p>
      </div>

      {/* Hero */}
      <article
        className="user-split-hero"
        style={{
          background: "linear-gradient(135deg, #0c4a6e, #0ea5e9)",
          color: "#fff",
          borderRadius: 18,
          padding: 28,
          marginBottom: 18,
        }}
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
            <TbFlask size={13} /> PAPER TRADING
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: -0.6,
            }}
          >
            {isAuthed
              ? `Your virtual balance: ${formatINR(balance, true)}`
              : "Practice with ₹10L virtual capital"}
          </h2>
          <p
            style={{
              margin: "8px 0 16px",
              color: "rgba(255,255,255,0.78)",
              fontSize: 13,
            }}
          >
            {isAuthed
              ? `${trades.length} trades executed. Build a strategy without risk.`
              : "Test strategies, learn the market, climb the leaderboard — all with simulated money."}
          </p>
          {isAuthed ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/user/wallet"
                style={{
                  padding: "12px 22px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.95)",
                  color: "#0c4a6e",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Add funds
              </Link>
              <Link
                href="/user/portfolio"
                style={{
                  padding: "12px 22px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.35)",
                }}
              >
                View holdings
              </Link>
            </div>
          ) : (
            <AuthGate
              isAuthenticated={isAuthed}
              promptTitle="Sign in to start trading"
              promptDescription="Open a free account to access your ₹10L virtual capital and start practicing."
            >
              <span />
            </AuthGate>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {[
            { label: "BALANCE", value: formatINR(balance || 1000000, true) },
            { label: "TRADES", value: trades.length.toString() },
            { label: "P&L", value: pnlLabel },
            { label: "RANK", value: isAuthed ? "—" : "Top 10%" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                backdropFilter: "blur(8px)",
              }}
            >
              <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
                {s.label}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600, letterSpacing: -0.5 }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </article>

      <div className="user-split-chart">
        {/* Performance chart */}
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Lab Performance — Last 14 days
          </h3>
          <AreaChart
            data={chartData}
            color="#16a34a"
            height={240}
            valueFormatter={(n) => formatINR(n, true)}
          />
        </article>

        {/* Leaderboard */}
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
            <FiAward size={16} /> Leaderboard
          </h3>

          {leaderboard.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "40px 0" }}>
              No leaderboard data yet — be among the first to compete.
            </p>
          ) : (
            leaderboard.map((row, i) => {
              const isMe = userId && row.user?.id === userId;
              const initials = (row.user?.fullName ?? "??")
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <div
                  key={`${row.periodId}-${row.userId}`}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                    background: isMe ? "rgba(14,165,233,0.04)" : "transparent",
                    margin: isMe ? "0 -8px" : 0,
                    paddingLeft: isMe ? 8 : 0,
                    paddingRight: isMe ? 8 : 0,
                    borderRadius: isMe ? 8 : 0,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      fontSize: 13,
                      fontWeight: 600,
                      color: i < 3 ? "#0ea5e9" : "var(--text-muted)",
                    }}
                  >
                    #{i + 1}
                  </span>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
                      color: "#0ea5e9",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {initials}
                  </div>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                    {row.user?.fullName ?? "User"} {isMe ? " (you)" : ""}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>
                    +{Number(row.roiPct).toFixed(2)}%
                  </span>
                </div>
              );
            })
          )}
        </article>
      </div>

      {isAuthed && (
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
            marginBottom: 18,
          }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Place paper trade
          </h3>
          <PaperTradeForm />
        </article>
      )}

      {/* AI Agents */}
      {agents.length > 0 && (
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>AI Agents</h3>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Custom AI assistants trained for financial analysis and strategy</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {(agents as AgentRow[]).map((a) => (
              <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#ede9fe,#c7d2fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {a.avatar}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.model.replace("gemini-", "Gemini ").replace(/-/g, " ")}</div>
                  </div>
                </div>
                {a.description && (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {a.description}
                  </p>
                )}
                {isAuthed ? (
                  <Link
                    href={`/user/lab/agents/${a.id}`}
                    style={{ display: "inline-block", padding: "8px 16px", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" }}
                  >
                    Chat
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    style={{ display: "inline-block", padding: "8px 16px", background: "var(--surface-2)", color: "var(--text-muted)", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none", textAlign: "center" }}
                  >
                    Sign in to chat
                  </Link>
                )}
              </div>
            ))}
          </div>
        </article>
      )}

      {/* Recent trades */}
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
            Recent Lab Trades
          </h3>
        </div>

        {!isAuthed ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 13 }}>
              Sign up to start placing virtual trades and tracking your performance.
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
              Open the Lab
            </Link>
          </div>
        ) : trades.length === 0 ? (
          <p style={{ margin: 0, padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No trades yet — place your first virtual trade.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {["Symbol", "Side", "Quantity", "Price", "Value", "When"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
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
                {trades.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 18px", fontWeight: 700 }}>{t.symbol}</td>
                    <td style={{ padding: "12px 18px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          background: t.side === "buy" ? "#d1fae5" : "#fee2e2",
                          color: t.side === "buy" ? "#047857" : "#991b1b",
                          textTransform: "uppercase",
                        }}
                      >
                        {t.side}
                      </span>
                    </td>
                    <td style={{ padding: "12px 18px" }}>{Number(t.quantity)}</td>
                    <td style={{ padding: "12px 18px" }}>{formatINR(Number(t.price))}</td>
                    <td style={{ padding: "12px 18px", fontWeight: 600 }}>
                      {formatINR(Number(t.price) * Number(t.quantity))}
                    </td>
                    <td style={{ padding: "12px 18px", color: "var(--text-muted)", fontSize: 11 }}>
                      {t.tradedAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
