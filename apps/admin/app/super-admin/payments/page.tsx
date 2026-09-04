import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma, PaymentStatus } from "@prisma/client";
import TablePager from "@/components/table-pager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = { status?: string; page?: string; sort?: string };

const SORTS: { key: string; label: string; orderBy: Prisma.PaymentOrderByWithRelationInput }[] = [
  { key: "recent", label: "Newest", orderBy: { createdAt: "desc" } },
  { key: "amount", label: "Highest amount", orderBy: { amount: "desc" } },
];

function formatINR(n: number, compact = false) {
  if (compact && Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (compact && Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (compact && Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "success", label: "Success" },
  { key: "created", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
];

const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  success: { bg: "#dcfce7", color: "#15803d" },
  created: { bg: "#fef9c3", color: "#a16207" },
  failed: { bg: "#fee2e2", color: "#b91c1c" },
  refunded: { bg: "#e0e7ff", color: "#4338ca" },
};

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const status = STATUS_TABS.some((t) => t.key === searchParams.status)
    ? (searchParams.status as string)
    : "all";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const sort = SORTS.find((s) => s.key === searchParams.sort) ?? SORTS[0];

  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);

  const where: Prisma.PaymentWhereInput =
    status === "all" ? {} : { status: status as PaymentStatus };

  const [rows, totalForFilter, revenue30, successCount, failedCount, refundedCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: sort.orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { status: "success", createdAt: { gte: thirty } },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: "success" } }),
    prisma.payment.count({ where: { status: "failed" } }),
    prisma.payment.count({ where: { status: "refunded" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalForFilter / PAGE_SIZE));

  const stats = [
    { label: "Revenue (30d)", value: formatINR(Number(revenue30._sum.amount ?? 0), true) },
    { label: "Successful", value: successCount.toLocaleString() },
    { label: "Failed", value: failedCount.toLocaleString(), tone: failedCount > 0 ? "#dc2626" : undefined },
    { label: "Refunded", value: refundedCount.toLocaleString() },
  ];

  return (
    <section>
      <h1 className="page-title">Payments</h1>
      <p className="page-subtitle">
        Every transaction across subscriptions, unlocks, and courses. Live data — gateway actions
        (refund / retry / payout) activate once the payment provider API is connected.
      </p>

      {/* Gateway status banner — payment provider not yet wired */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          margin: "16px 0",
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px dashed var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)" }}>Payment gateway: not connected.</strong> Transactions
          shown are recorded in the platform; refunds and payouts require the provider API.
        </span>
        <Link
          href="/super-admin/settings"
          className="btn-primary"
          style={{ whiteSpace: "nowrap", textDecoration: "none" }}
        >
          Configure in Settings
        </Link>
      </div>

      <div className="ui-stats">
        {stats.map((s) => (
          <article key={s.label} className="ui-stat">
            <p className="ui-stat-label">{s.label}</p>
            <p className="ui-stat-value" style={{ color: s.tone ?? "var(--text)" }}>
              {s.value}
            </p>
          </article>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {STATUS_TABS.map((t) => {
          const active = t.key === status;
          return (
            <Link
              key={t.key}
              href={`/super-admin/payments?status=${t.key}&sort=${sort.key}`}
              className={`ui-chip${active ? " is-active" : ""}`}
            >
              {t.label}
            </Link>
          );
        })}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Sort:</span>
        {SORTS.map((s) => {
          const active = s.key === sort.key;
          return (
            <Link
              key={s.key}
              href={`/super-admin/payments?status=${status}&sort=${s.key}`}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid var(--border)",
                background: active ? "var(--accent-blue-soft, rgba(37,99,235,0.12))" : "var(--surface)",
                color: active ? "var(--accent-blue, #2563eb)" : "var(--text-muted)",
              }}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <article className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", margin: 0 }}>
            No {status === "all" ? "" : status} payments found.
          </p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Txn", "User", "Type", "Provider", "Amount", "Status", "Date"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "Amount" ? "right" : "left",
                        padding: "12px 16px",
                        fontWeight: 600,
                        fontSize: 11,
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
                {rows.map((p) => {
                  const tone = STATUS_TONE[p.status] ?? {
                    bg: "var(--surface-2)",
                    color: "var(--text-muted)",
                  };
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: "var(--text-muted)",
                        }}
                      >
                        #{p.id}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{p.user?.fullName ?? "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {p.user?.email ?? ""}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>
                        {p.kind.replace(/_/g, " ")}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                        {p.provider ?? "—"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }}>
                        {formatINR(Number(p.amount))}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: tone.bg,
                            color: tone.color,
                            textTransform: "capitalize",
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {p.createdAt.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePager
              basePath="/super-admin/payments"
              params={{ status, sort: sort.key }}
              page={page}
              totalPages={totalPages}
              total={totalForFilter}
            />
          </div>
        )}
      </article>
    </section>
  );
}
