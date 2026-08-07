import { prisma } from "@/lib/prisma";
import TablePager from "@/components/table-pager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = { module?: string; page?: string };

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

function toneFor(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("approved") || a.includes("created") || a.includes("verified")) return "#16a34a";
  if (a.includes("reject") || a.includes("flag") || a.includes("removed") || a.includes("delete")) return "#dc2626";
  return "#2563eb";
}

export default async function AuditLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const moduleFilter = searchParams.module?.trim() || "";
  const where = moduleFilter ? { module: moduleFilter } : {};

  const [rows, total, modules] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { fullName: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["module"], select: { module: true }, orderBy: { module: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const moduleOptions = ["", ...modules.map((m) => m.module)];

  return (
    <section>
      <h1 className="page-title">Audit Logs</h1>
      <p className="page-subtitle">Every administrative action across the platform, newest first.</p>

      {/* Module filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "16px 0" }}>
        {moduleOptions.map((m) => {
          const active = (m || "") === moduleFilter;
          return (
            <a
              key={m || "all"}
              href={m ? `/super-admin/audit-logs?module=${encodeURIComponent(m)}` : "/super-admin/audit-logs"}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                textDecoration: "none",
                border: "1px solid var(--border)",
                background: active ? "var(--primary-soft)" : "var(--surface)",
                color: active ? "#047857" : "var(--text-muted)",
                textTransform: "capitalize",
              }}
            >
              {m ? m.replace(/_/g, " ") : "All"}
            </a>
          );
        })}
      </div>

      <article className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", margin: 0 }}>
            No activity logged yet.
          </p>
        ) : (
          <div className="table-wrap">
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Action", "Actor", "Module", "Target", "When"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
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
                {rows.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, textTransform: "capitalize" }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: toneFor(log.action), flexShrink: 0 }} />
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {log.actor?.fullName ?? "System"}
                      {log.actor?.role && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}> · {log.actor.role.replace("_", " ")}</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                      {log.module.replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>
                      {log.targetKind ? `${log.targetKind}${log.targetId ? `#${log.targetId}` : ""}` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {relTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePager
              basePath="/super-admin/audit-logs"
              params={{ module: moduleFilter || undefined }}
              page={page}
              totalPages={totalPages}
              total={total}
            />
          </div>
        )}
      </article>
    </section>
  );
}
