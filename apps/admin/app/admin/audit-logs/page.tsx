import { prisma } from "@/lib/prisma";

type SearchParams = { module?: string; page?: string };

const MODULES = ["advisors", "market_posts", "community", "users", "reports"];

export default async function AdminAuditLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const moduleFilter = searchParams.module;
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const perPage = 50;

  const where: Record<string, unknown> = {};
  if (moduleFilter && MODULES.includes(moduleFilter)) {
    where.module = moduleFilter;
  }

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
    <section>
      <h1 className="page-title">Audit Logs</h1>
      <p className="page-subtitle">Every moderation and governance action across the platform.</p>

      <form method="GET">
        <article className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <select name="module" className="input" defaultValue={moduleFilter ?? ""}>
              <option value="">All modules</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary">
              Filter
            </button>
          </div>
        </article>
      </form>

      <article className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Module</th>
                <th>Target</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "#61708b", padding: "20px 12px" }}>
                    No audit events match.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.createdAt.toLocaleString()}</td>
                    <td>
                      {log.actor?.fullName ?? "System"}
                      {log.actor?.role ? (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 11,
                            padding: "1px 6px",
                            borderRadius: 999,
                            background: "#eef2f7",
                            textTransform: "capitalize",
                          }}
                        >
                          {log.actor.role}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.action}</td>
                    <td>{log.module}</td>
                    <td style={{ fontSize: 12, color: "#61708b" }}>
                      {log.targetKind ? `${log.targetKind}#${log.targetId ?? "—"}` : "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>{log.ipAddress ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
            }}
          >
            <span style={{ color: "#61708b" }}>
              Page {page} of {totalPages} · {total.toLocaleString()} events
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {page > 1 && (
                <a
                  href={`/admin/audit-logs?${new URLSearchParams({
                    ...(moduleFilter ? { module: moduleFilter } : {}),
                    page: String(page - 1),
                  }).toString()}`}
                  className="input"
                  style={{ width: "auto", padding: "8px 14px", textDecoration: "none", color: "inherit" }}
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
                  className="btn-primary"
                  style={{ padding: "8px 14px" }}
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
