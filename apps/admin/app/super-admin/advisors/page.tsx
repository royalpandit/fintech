import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Sparkline from "@/components/advisor-ui/sparkline";

export const dynamic = "force-dynamic";

function formatINR(n: number, compact = false) {
  if (!n && n !== 0) return "₹0";
  if (compact && Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (compact && Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (compact && Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  approved: { bg: "#d1fae5", fg: "#047857" },
  pending: { bg: "#fef3c7", fg: "#92400e" },
  rejected: { bg: "#fee2e2", fg: "#991b1b" },
};

export default async function SuperAdminAdvisorsPage() {
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [
    pendingCount,
    approvedCount,
    rejectedCount,
    monthlyRevenue,
    topAdvisorMetrics,
    pendingVerification,
    recentApprovals,
  ] = await Promise.all([
    prisma.advisorProfile.count({ where: { verificationStatus: "pending" } }),
    prisma.advisorProfile.count({ where: { verificationStatus: "approved" } }),
    prisma.advisorProfile.count({ where: { verificationStatus: "rejected" } }),
    prisma.payment.aggregate({
      where: { status: "success", createdAt: { gte: monthAgo } },
      _sum: { amount: true },
    }),
    prisma.advisorMetricDaily.groupBy({
      by: ["advisorUserId"],
      where: { day: { gte: monthAgo } },
      _sum: { earningsAmount: true, subscribersCount: true },
      orderBy: { _sum: { earningsAmount: "desc" } },
      take: 5,
    }),
    prisma.advisorProfile.findMany({
      where: { verificationStatus: "pending" },
      take: 8,
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.advisorProfile.findMany({
      where: { verificationStatus: "approved" },
      take: 6,
      orderBy: { verifiedAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true } },
        verifiedBy: { select: { fullName: true } },
      },
    }),
  ]);

  // Hydrate top advisor users
  const topIds = topAdvisorMetrics.map((m) => m.advisorUserId);
  const topUsers = await prisma.user.findMany({
    where: { id: { in: topIds } },
    select: {
      id: true,
      fullName: true,
      advisorProfile: { select: { sebiRegistrationNo: true, expertiseTags: true } },
    },
  });
  const userById = new Map(topUsers.map((u) => [u.id, u]));

  const summary = [
    {
      label: "Pending Verification",
      value: pendingCount.toLocaleString(),
      color: "#f59e0b",
    },
    {
      label: "Approved Advisors",
      value: approvedCount.toLocaleString(),
      color: "#10b981",
    },
    {
      label: "Rejected Applications",
      value: rejectedCount.toLocaleString(),
      color: "#ef4444",
    },
    {
      label: "Monthly Revenue",
      value: formatINR(Number(monthlyRevenue._sum.amount ?? 0), true),
      color: "#7c3aed",
    },
  ];

  return (
    <section className="advisor-scope" style={{ ["--advisor-primary" as any]: "#7c3aed" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.6,
            }}
          >
            Advisor Overview
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Approval monitoring, verification queue, and advisor quality analytics
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {summary.map((s) => (
          <article key={s.label} className="stat-card">
            <p className="stat-card-label">{s.label}</p>
            <p className="stat-card-value" style={{ color: s.color }}>
              {s.value}
            </p>
          </article>
        ))}
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, marginBottom: 14 }}
      >
        <article className="widget" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid #eef0f4",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Top Earning Advisors</h3>
            <Link
              href="/super-admin/users?role=advisor"
              style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}
            >
              View all
            </Link>
          </div>

          {topAdvisorMetrics.length === 0 ? (
            <p
              style={{ margin: 0, padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}
            >
              No advisor earnings yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["#", "Advisor", "SEBI ID", "Subscribers", "30d Earnings", ""].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign:
                            h === "Subscribers" || h === "30d Earnings" ? "right" : "left",
                          padding: "12px 16px",
                          fontWeight: 600,
                          fontSize: 11,
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
                  {topAdvisorMetrics.map((row, i) => {
                    const u = userById.get(row.advisorUserId);
                    return (
                      <tr key={row.advisorUserId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontWeight: 700,
                            color: i < 3 ? "#7c3aed" : "#94a3b8",
                          }}
                        >
                          {i + 1}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <Link
                            href={`/super-admin/advisors/${row.advisorUserId}`}
                            style={{
                              color: "#0f172a",
                              fontWeight: 700,
                              textDecoration: "none",
                            }}
                          >
                            {u?.fullName ?? "—"}
                          </Link>
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontFamily: "monospace",
                            fontSize: 11,
                            color: "#475569",
                          }}
                        >
                          {u?.advisorProfile?.sebiRegistrationNo ?? "—"}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>
                          {row._sum.subscribersCount?.toLocaleString() ?? 0}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#16a34a",
                          }}
                        >
                          {formatINR(Number(row._sum.earningsAmount ?? 0), true)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <Link
                            href={`/super-admin/advisors/${row.advisorUserId}`}
                            style={{
                              fontSize: 11,
                              color: "#7c3aed",
                              fontWeight: 700,
                              textDecoration: "none",
                            }}
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="widget">
          <div className="widget-title">
            <h3>Recent Approvals</h3>
            <Link href="/super-admin/users?role=advisor">View all</Link>
          </div>
          {recentApprovals.length === 0 ? (
            <p
              style={{ margin: 0, padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}
            >
              No recent approvals.
            </p>
          ) : (
            recentApprovals.map((adv) => (
              <Link
                key={adv.id}
                href={`/super-admin/advisors/${adv.user?.id}`}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid #f1f5f9",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                    {adv.user?.fullName ?? "Advisor"}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    {adv.sebiRegistrationNo} ·{" "}
                    {adv.verifiedAt?.toLocaleDateString() ?? ""}
                  </div>
                </div>
              </Link>
            ))
          )}
        </article>
      </div>

      <article className="widget" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid #eef0f4",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            Pending Verification ({pendingCount})
          </h3>
          <Link
            href="/super-admin/users?role=advisor&status=pending"
            style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}
          >
            Open queue
          </Link>
        </div>

        {pendingVerification.length === 0 ? (
          <p
            style={{ margin: 0, padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}
          >
            ✓ No advisors awaiting verification.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Advisor", "SEBI ID", "Submitted", "Status", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "" ? "right" : "left",
                        padding: "12px 18px",
                        fontWeight: 600,
                        fontSize: 11,
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
                {pendingVerification.map((adv) => {
                  const sc = STATUS_COLORS[adv.verificationStatus] ?? STATUS_COLORS.pending;
                  const initials = (adv.user?.fullName ?? "??")
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <tr key={adv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 18px" }}>
                        <Link
                          href={`/super-admin/advisors/${adv.user?.id}`}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            color: "#0f172a",
                            textDecoration: "none",
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: "rgba(124, 58, 237, 0.13)",
                              color: "#7c3aed",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 11,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                              {adv.user?.fullName}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{adv.user?.email}</div>
                          </div>
                        </Link>
                      </td>
                      <td
                        style={{
                          padding: "12px 18px",
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: "#475569",
                        }}
                      >
                        {adv.sebiRegistrationNo}
                      </td>
                      <td style={{ padding: "12px 18px", color: "#64748b", fontSize: 12 }}>
                        {adv.createdAt.toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: sc.bg,
                            color: sc.fg,
                            textTransform: "capitalize",
                          }}
                        >
                          {adv.verificationStatus}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px", textAlign: "right" }}>
                        <Link
                          href={`/super-admin/advisors/${adv.user?.id}`}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            background: "#7c3aed",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
