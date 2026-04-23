import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import PayoutRequestForm from "./payout-form";

export const dynamic = "force-dynamic";

function formatINR(n: number | null | undefined) {
  if (!n) return "₹0";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function payoutStatusColor(status: string) {
  if (status === "paid") return "#10b981";
  if (status === "rejected") return "#ef4444";
  if (status === "processing") return "#2563eb";
  return "#f59e0b";
}

export default async function AdvisorEarningsPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");
  const userId = auth.userId;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [wallet, dailyMetrics, payouts, revenueLast30, revenueLast90, pendingPayout] = await Promise.all([
    prisma.advisorWallet.findUnique({ where: { advisorUserId: userId } }),
    prisma.advisorMetricDaily.findMany({
      where: { advisorUserId: userId, day: { gte: ninetyDaysAgo } },
      orderBy: { day: "asc" },
    }),
    prisma.payoutRequest.findMany({
      where: { advisorUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.advisorMetricDaily.aggregate({
      where: { advisorUserId: userId, day: { gte: thirtyDaysAgo } },
      _sum: { earningsAmount: true },
    }),
    prisma.advisorMetricDaily.aggregate({
      where: { advisorUserId: userId, day: { gte: ninetyDaysAgo } },
      _sum: { earningsAmount: true },
    }),
    prisma.payoutRequest.findFirst({
      where: { advisorUserId: userId, status: { in: ["requested", "processing"] } },
    }),
  ]);

  const balance = wallet?.balance ? Number(wallet.balance) : 0;
  const maxEarnings = Math.max(1, ...dailyMetrics.map((m) => Number(m.earningsAmount || 0)));

  return (
    <section>
      <h1 className="page-title">Earnings</h1>
      <p className="page-subtitle">Wallet balance, revenue trend, and payout history.</p>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <article className="card" style={{ background: "linear-gradient(135deg, #047857, #10b981)", color: "#fff", borderColor: "#047857" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#d1fae5", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
            Wallet Balance
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 42, fontWeight: 700 }}>{formatINR(balance)}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#d1fae5" }}>
            Available for payout
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Revenue (30d)</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {formatINR(revenueLast30._sum.earningsAmount ? Number(revenueLast30._sum.earningsAmount) : 0)}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Revenue (90d)</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {formatINR(revenueLast90._sum.earningsAmount ? Number(revenueLast90._sum.earningsAmount) : 0)}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Platform Fee</p>
          <p className="metric-value" style={{ fontSize: 34 }}>20%</p>
          <p style={{ margin: 0, fontSize: 12, color: "#61708b" }}>Advisor keeps 80%</p>
        </article>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16, alignItems: "start" }}>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Daily Earnings — Last 90 days</h3>
          {dailyMetrics.length === 0 ? (
            <p className="page-subtitle" style={{ margin: 0 }}>
              No earnings yet. Earnings are computed daily from active subscriptions and course enrollments.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "end", gap: 2, height: 160, marginTop: 16 }}>
                {dailyMetrics.map((m) => {
                  const value = Number(m.earningsAmount || 0);
                  const heightPct = (value / maxEarnings) * 100;
                  return (
                    <div
                      key={m.id}
                      title={`${m.day.toLocaleDateString()}: ${formatINR(value)}`}
                      style={{
                        flex: 1,
                        height: `${Math.max(2, heightPct)}%`,
                        background: "linear-gradient(180deg, #10b981, #047857)",
                        borderRadius: 2,
                        minHeight: 2,
                      }}
                    />
                  );
                })}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontSize: 11,
                  color: "#61708b",
                }}
              >
                <span>{dailyMetrics[0]?.day.toLocaleDateString()}</span>
                <span>{dailyMetrics[dailyMetrics.length - 1]?.day.toLocaleDateString()}</span>
              </div>
            </>
          )}
        </article>

        <PayoutRequestForm
          balance={balance}
          hasPendingRequest={Boolean(pendingPayout)}
          pendingAmount={pendingPayout ? Number(pendingPayout.amount) : null}
        />
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Payout History</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Requested</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reviewed</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#61708b" }}>
                    No payouts yet. Request your first payout when your wallet has a balance.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.createdAt.toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600 }}>{formatINR(Number(p.amount))}</td>
                    <td>
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: `${payoutStatusColor(p.status)}22`,
                          color: payoutStatusColor(p.status),
                          textTransform: "capitalize",
                        }}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td>{p.updatedAt.toLocaleDateString()}</td>
                    <td style={{ fontSize: 12, color: "#61708b" }}>{p.reviewNote ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
