import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ReportRowActions from "./report-row-actions";
import TablePager from "@/components/table-pager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = { status?: string; page?: string };

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

function contentHref(kind: string, id: number): string | null {
  if (kind === "market_post" || kind === "post") return `/super-admin/market-posts/${id}`;
  return null;
}

const STATUS_TABS = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
];

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const status = STATUS_TABS.some((t) => t.key === searchParams.status)
    ? (searchParams.status as string)
    : "open";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [rows, openCount, resolvedCount, dismissedCount] = await Promise.all([
    prisma.contentReport.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { reporter: { select: { id: true, fullName: true } } },
    }),
    prisma.contentReport.count({ where: { status: "open" } }),
    prisma.contentReport.count({ where: { status: "resolved" } }),
    prisma.contentReport.count({ where: { status: "dismissed" } }),
  ]);

  const totalForStatus =
    status === "open" ? openCount : status === "resolved" ? resolvedCount : dismissedCount;
  const totalPages = Math.max(1, Math.ceil(totalForStatus / PAGE_SIZE));

  const stats = [
    { label: "Open", value: openCount, tone: openCount > 0 ? "#dc2626" : "#16a34a" },
    { label: "Resolved", value: resolvedCount, tone: "var(--text)" },
    { label: "Dismissed", value: dismissedCount, tone: "var(--text)" },
    { label: "Total", value: openCount + resolvedCount + dismissedCount, tone: "var(--text)" },
  ];

  return (
    <section>
      <h1 className="page-title">Reports</h1>
      <p className="page-subtitle">
        User-submitted reports of posts, comments, and profiles. Resolve to action them, dismiss if
        no action is needed.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          margin: "16px 0",
        }}
      >
        {stats.map((s) => (
          <article key={s.label} className="stat-card">
            <p className="stat-card-label">{s.label}</p>
            <p className="stat-card-value" style={{ color: s.tone }}>
              {s.value}
            </p>
          </article>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {STATUS_TABS.map((t) => {
          const active = t.key === status;
          return (
            <Link
              key={t.key}
              href={`/super-admin/reports?status=${t.key}`}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid var(--border)",
                background: active ? "var(--primary-soft)" : "var(--surface)",
                color: active ? "#047857" : "var(--text-muted)",
              }}
            >
              {t.label}
              {t.key === "open" ? ` (${openCount})` : ""}
            </Link>
          );
        })}
      </div>

      <article className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              padding: 48,
              color: "var(--text-muted)",
              fontSize: 14,
              margin: 0,
            }}
          >
            No {status} reports.
          </p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Content", "Reason", "Reported by", "When", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "" ? "right" : "left",
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
                {rows.map((r) => {
                  const href = contentHref(r.contentKind, r.contentId);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, textTransform: "capitalize" }}>
                          {r.contentKind.replace(/_/g, " ")}
                        </div>
                        {href ? (
                          <Link href={href} style={{ fontSize: 12, color: "#047857" }}>
                            #{r.contentId} →
                          </Link>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            #{r.contentId}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: 360 }}>{r.reason}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {r.reporter?.fullName ?? "—"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {relTime(r.createdAt)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <ReportRowActions id={r.id} status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePager
              basePath="/super-admin/reports"
              params={{ status }}
              page={page}
              totalPages={totalPages}
              total={totalForStatus}
            />
          </div>
        )}
      </article>
    </section>
  );
}
