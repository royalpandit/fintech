import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { module?: string; page?: string };

const MODULES = ["advisors", "market_posts", "community", "users", "reports", "payments"];

const MODULE_COLORS: Record<string, string> = {
  advisors: "#10b981",
  market_posts: "#2563eb",
  users: "#f59e0b",
  reports: "#dc2626",
  community: "#7c3aed",
  payments: "#0ea5e9",
};

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

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const moduleFilter = searchParams.module;
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const perPage = 50;

  const where: Record<string, unknown> = {};
  if (moduleFilter && MODULES.includes(moduleFilter)) where.module = moduleFilter;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { actor: { select: { fullName: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

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
            Audit Logs
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Every moderation and governance action across the platform
          </p>
        </div>
      </div>

      <article className="widget" style={{ marginBottom: 14 }}>
        <form method="GET">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              name="module"
              defaultValue={moduleFilter ?? ""}
              style={{
                height: 40,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid #eef0f4",
                background: "#f8fafc",
                fontSize: 13,
                outline: "none",
                minWidth: 200,
              }}
            >
              <option value="">All modules</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="submit"
              style={{
                height: 40,
                padding: "0 22px",
                borderRadius: 10,
                background: "#2563eb",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Filter
            </button>
          </div>
        </form>
      </article>

      <article className="widget" style={{ padding: 0, overflow: "hidden" }}>
        {logs.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 48,
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            No audit events match.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["When", "Actor", "Action", "Module", "Target", "IP"].map((h) => (
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
                {logs.map((log) => {
                  const moduleColor = MODULE_COLORS[log.module] ?? "#64748b";
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 18px", color: "#475569", fontSize: 11 }}>
                        {relTime(log.createdAt)}
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>
                          {log.createdAt.toLocaleString()}
                        </div>
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          {log.actor?.fullName ?? "System"}
                        </div>
                        {log.actor?.role && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 999,
                              background: "#eef0f4",
                              color: "#475569",
                              textTransform: "capitalize",
                              fontWeight: 600,
                            }}
                          >
                            {log.actor.role.replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "12px 18px",
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}
                      >
                        {log.action.replace(/_/g, " ")}
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: moduleColor + "1a",
                            color: moduleColor,
                          }}
                        >
                          {log.module}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px", fontSize: 11, color: "#64748b" }}>
                        {log.targetKind ? `${log.targetKind}#${log.targetId ?? "—"}` : "—"}
                      </td>
                      <td style={{ padding: "12px 18px", fontSize: 11, color: "#94a3b8" }}>
                        {log.ipAddress ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div
            style={{
              padding: 14,
              borderTop: "1px solid #eef0f4",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <span style={{ color: "#64748b" }}>
              Page {page} of {totalPages} · {total.toLocaleString()} events
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {page > 1 && (
                <a
                  href={`/admin/audit-logs?${new URLSearchParams({
                    ...(moduleFilter ? { module: moduleFilter } : {}),
                    page: String(page - 1),
                  }).toString()}`}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #eef0f4",
                    background: "#fff",
                    color: "#475569",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Previous
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`/admin/audit-logs?${new URLSearchParams({
                    ...(moduleFilter ? { module: moduleFilter } : {}),
                    page: String(page + 1),
                  }).toString()}`}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#2563eb",
                    color: "#fff",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Next
                </a>
              )}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
