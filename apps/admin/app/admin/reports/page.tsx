import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { status?: string };

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

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#fee2e2", fg: "#991b1b" },
  resolved: { bg: "#d1fae5", fg: "#047857" },
  dismissed: { bg: "#e5e7eb", fg: "#475569" },
};

export default async function AdminReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const status = searchParams.status ?? "open";
  const valid = ["open", "resolved", "dismissed"].includes(status);
  const where = valid ? { status } : { status: "open" };

  const [openCount, resolvedCount, dismissedCount, rows] = await Promise.all([
    prisma.contentReport.count({ where: { status: "open" } }),
    prisma.contentReport.count({ where: { status: "resolved" } }),
    prisma.contentReport.count({ where: { status: "dismissed" } }),
    prisma.contentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        reporter: { select: { fullName: true, email: true } },
        resolvedBy: { select: { fullName: true } },
      },
    }),
  ]);

  const tabs = [
    { key: "open", label: `Open (${openCount})`, color: "#dc2626" },
    { key: "resolved", label: `Resolved (${resolvedCount})`, color: "#16a34a" },
    { key: "dismissed", label: `Dismissed (${dismissedCount})`, color: "#64748b" },
  ];

  return (
    <section className="advisor-scope" style={{ ["--advisor-primary" as any]: "#2563eb" }}>
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
            Content Reports
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Community-reported posts, comments, and profiles
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {tabs.map((t) => {
          const value =
            t.key === "open" ? openCount : t.key === "resolved" ? resolvedCount : dismissedCount;
          return (
            <Link
              key={t.key}
              href={`/admin/reports?status=${t.key}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article
                className="stat-card"
                style={{
                  cursor: "pointer",
                  borderColor: status === t.key ? t.color : "#eef0f4",
                }}
              >
                <p className="stat-card-label">{t.label.split(" (")[0]}</p>
                <p className="stat-card-value" style={{ color: t.color }}>
                  {value.toLocaleString()}
                </p>
              </article>
            </Link>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reports?status=${t.key}`}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: status === t.key ? "#fff" : "#64748b",
              background: status === t.key ? "#2563eb" : "#fff",
              border: "1px solid #eef0f4",
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <article className="widget" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 48,
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            No reports in this bucket.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Content", "Reason", "Reporter", "Status", "Reported", "Resolved By"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
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
                {rows.map((r) => {
                  const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.open;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                          {r.contentKind} #{r.contentId}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px", maxWidth: 320 }}>{r.reason}</td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          {r.reporter?.fullName ?? "—"}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {r.reporter?.email ?? ""}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
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
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", color: "#64748b", fontSize: 11 }}>
                        {relTime(r.createdAt)}
                      </td>
                      <td style={{ padding: "14px 18px", color: "#64748b", fontSize: 11 }}>
                        {r.resolvedBy?.fullName ?? "—"}
                        {r.resolvedAt ? ` · ${r.resolvedAt.toLocaleDateString()}` : ""}
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
