import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SUB_PLANS,
  inferPlanLabel,
  subscriptionDisplayStatus,
} from "@/lib/subscription-plans";
import SubscriptionsFilters from "./subscriptions-filters";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  status?: string;
  plan?: string;
  page?: string;
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: "#d1fae5", fg: "#047857" },
  expired: { bg: "#f1f5f9", fg: "#64748b" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b" },
  pending: { bg: "#fef3c7", fg: "#92400e" },
};

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function buildWhere(
  q: string,
  status: string,
  plan: string,
): Prisma.SubscriptionWhereInput {
  const where: Prisma.SubscriptionWhereInput = {};

  if (q) {
    where.OR = [
      { user: { fullName: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q.toLowerCase(), mode: "insensitive" } } },
      { advisor: { fullName: { contains: q, mode: "insensitive" } } },
      { advisor: { email: { contains: q.toLowerCase(), mode: "insensitive" } } },
    ];
  }

  if (plan === "monthly") where.amount = SUB_PLANS.monthly.price;
  else if (plan === "yearly") where.amount = SUB_PLANS.yearly.price;
  else if (plan === "free") where.amount = 0;

  const now = new Date();
  if (status === "active") {
    where.status = "active";
    where.endDate = { gt: now };
  } else if (status === "expired") {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { status: "expired" },
          { status: "active", endDate: { lte: now } },
        ],
      },
    ];
  } else if (status === "cancelled" || status === "pending") {
    where.status = status;
  }

  return where;
}

export default async function SuperAdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status ?? "";
  const plan = searchParams.plan ?? "";
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const perPage = 25;
  const where = buildWhere(q, status, plan);
  const now = new Date();

  const [
    subscriptions,
    filteredCount,
    totalCount,
    activeCount,
    monthlyCount,
    yearlyCount,
    revenueSum,
  ] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        advisor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            advisorProfile: { select: { sebiRegistrationNo: true } },
          },
        },
      },
    }),
    prisma.subscription.count({ where }),
    prisma.subscription.count(),
    prisma.subscription.count({
      where: { status: "active", endDate: { gt: now } },
    }),
    prisma.subscription.count({ where: { amount: SUB_PLANS.monthly.price } }),
    prisma.subscription.count({ where: { amount: SUB_PLANS.yearly.price } }),
    prisma.subscription.aggregate({ _sum: { amount: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / perPage));

  return (
    <section className="advisor-scope" style={{ ["--advisor-primary" as any]: "#7c3aed" }}>
      <div style={{ marginBottom: 18 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: -0.6,
          }}
        >
          Advisor Subscriptions
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
          See which users purchased which advisor plan — monthly, yearly, or free follow
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <article className="stat-card">
          <p className="stat-card-label">Total Subscriptions</p>
          <p className="stat-card-value">{totalCount.toLocaleString()}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Active</p>
          <p className="stat-card-value" style={{ color: "#10b981" }}>
            {activeCount.toLocaleString()}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Monthly Plans</p>
          <p className="stat-card-value">{monthlyCount.toLocaleString()}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Yearly Plans</p>
          <p className="stat-card-value">{yearlyCount.toLocaleString()}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card-label">Total Plan Value</p>
          <p className="stat-card-value">{formatINR(Number(revenueSum._sum.amount ?? 0))}</p>
        </article>
      </div>

      <SubscriptionsFilters initialQ={q} initialStatus={status} initialPlan={plan} />

      <article className="widget" style={{ padding: 0, overflow: "hidden", marginTop: 14 }}>
        {subscriptions.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 48,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            No subscriptions match these filters.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {[
                    "Subscriber",
                    "Advisor",
                    "Plan",
                    "Amount",
                    "Status",
                    "Start",
                    "End",
                    "Purchased",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 18px",
                        fontWeight: 600,
                        fontSize: 11,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => {
                  const displayStatus = subscriptionDisplayStatus(sub);
                  const sc = STATUS_COLORS[displayStatus] ?? STATUS_COLORS.pending;
                  const planLabel = inferPlanLabel(Number(sub.amount));

                  return (
                    <tr key={sub.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "14px 18px", minWidth: 200 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{sub.user.fullName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {sub.user.email}
                        </div>
                        {sub.user.phone && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {sub.user.phone}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px", minWidth: 200 }}>
                        <Link
                          href={`/super-admin/advisors/${sub.advisor.id}`}
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#7c3aed",
                            textDecoration: "none",
                          }}
                        >
                          {sub.advisor.fullName}
                        </Link>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {sub.advisor.email}
                        </div>
                        {sub.advisor.advisorProfile?.sebiRegistrationNo && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            SEBI {sub.advisor.advisorProfile.sebiRegistrationNo}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 18px", fontWeight: 600 }}>{planLabel}</td>
                      <td style={{ padding: "14px 18px", fontWeight: 600 }}>
                        {formatINR(Number(sub.amount))}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "capitalize",
                            background: sc.bg,
                            color: sc.fg,
                          }}
                        >
                          {displayStatus}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                        {formatDate(sub.startDate)}
                      </td>
                      <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                        {formatDate(sub.endDate)}
                      </td>
                      <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                        {formatDate(sub.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 14,
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>
            Page {page} of {totalPages} · {filteredCount} subscriptions
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {page > 1 && (
              <Link
                href={`/super-admin/subscriptions?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  ...(status ? { status } : {}),
                  ...(plan ? { plan } : {}),
                  page: String(page - 1),
                }).toString()}`}
                className="input"
                style={{ padding: "8px 14px", textDecoration: "none" }}
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/super-admin/subscriptions?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  ...(status ? { status } : {}),
                  ...(plan ? { plan } : {}),
                  page: String(page + 1),
                }).toString()}`}
                className="input"
                style={{ padding: "8px 14px", textDecoration: "none" }}
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
