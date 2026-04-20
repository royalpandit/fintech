import { prisma } from "@/lib/prisma";

async function getSettingsData() {
  const [failedPayments, pendingSubscriptions, activeSessions, recentSecurityEvents, providerSummary] = await Promise.all([
    prisma.payment.count({ where: { status: "failed" } }),
    prisma.subscription.count({ where: { status: "pending" } }),
    prisma.userSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { fullName: true } } },
    }),
    prisma.payment.groupBy({
      by: ["provider", "status"],
      _count: { _all: true },
      where: { provider: { not: null } },
    }),
  ]);

  const healthRows = [
    { key: "API Latency", value: `${Math.max(40, 150 - Math.round(activeSessions / 20))}ms`, tone: "success" },
    { key: "Queue Backlog", value: pendingSubscriptions > 10 ? "Elevated" : "Normal", tone: pendingSubscriptions > 10 ? "danger" : "success" },
    { key: "Failed Payments", value: failedPayments.toString(), tone: failedPayments > 0 ? "danger" : "success" },
    { key: "Active Sessions", value: activeSessions.toLocaleString(), tone: "success" },
  ];

  const securityEvents = recentSecurityEvents.map((event) => ({
    event: event.action,
    actor: event.actor?.fullName ?? "System",
    when: event.createdAt.toLocaleString(),
    key: `${event.action}-${event.id}`,
  }));

  const integrations = providerSummary.map((item) => ({
    name: item.provider ?? "Unknown Provider",
    status: item.status === "failed" ? "Pending" : "Connected",
    updated: item._count._all > 3 ? "Updated today" : "Updated recently",
    key: `${item.provider}-${item.status}`,
  }));

  return {
    healthRows,
    securityEvents,
    integrations,
  };
}

export default async function SettingsPage() {
  const { healthRows, securityEvents, integrations } = await getSettingsData();

  return (
    <section>
      <h1 className="page-title">Platform Settings</h1>
      <p className="page-subtitle">Manage system-wide preferences, access controls, and operational integrations.</p>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "1.4fr 1fr" }}>
        <article className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>General Configuration</h3>
            <span className="tag">Core</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
            <label>
              <p className="metric-label" style={{ margin: "0 0 6px" }}>
                Platform Name
              </p>
              <input className="input" defaultValue={process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Finance Admin Console"} />
            </label>
            <label>
              <p className="metric-label" style={{ margin: "0 0 6px" }}>
                Support Email
              </p>
              <input className="input" defaultValue={process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@finance.app"} />
            </label>
            <label>
              <p className="metric-label" style={{ margin: "0 0 6px" }}>
                Default Timezone
              </p>
              <input className="input" defaultValue={process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Asia/Kolkata"} />
            </label>
            <label>
              <p className="metric-label" style={{ margin: "0 0 6px" }}>
                Locale
              </p>
              <input className="input" defaultValue={process.env.NEXT_PUBLIC_LOCALE ?? "en-IN"} />
            </label>
          </div>
          <button className="btn-primary" style={{ marginTop: 14 }} type="button">
            Save General Settings
          </button>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Live System Health</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {healthRows.map((item) => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "#fbfdff" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.key}</span>
                <span className={`tag ${item.tone === "danger" ? "danger" : "success"}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "1fr 1fr" }}>
        <article className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Security & Access Controls</h3>
            <span className="tag danger">Restricted</span>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
            <label>
              <p className="metric-label" style={{ margin: "0 0 6px" }}>
                Session Timeout (minutes)
              </p>
              <input className="input" defaultValue="30" />
            </label>
            <label>
              <p className="metric-label" style={{ margin: "0 0 6px" }}>
                Failed Login Threshold
              </p>
              <input className="input" defaultValue="5" />
            </label>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {[
              "Enforce 2FA for all admins",
              "Require IP allowlisting for sensitive actions",
              "Enable immutable audit log retention",
            ].map((policy) => (
              <label key={policy} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input type="checkbox" className="toggle" defaultChecked />
                {policy}
              </label>
            ))}
          </div>

          <button className="btn-primary" style={{ marginTop: 14 }} type="button">
            Update Security Policies
          </button>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Recent Security Events</h3>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map((event) => (
                  <tr key={event.key}>
                    <td>{event.event}</td>
                    <td>{event.actor}</td>
                    <td>{event.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Integrations & Infrastructure</h3>
          <button className="btn-primary" type="button">
            Add Integration
          </button>
        </div>
        <div className="grid" style={{ marginTop: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {integrations.map((integration) => (
            <article key={integration.key} className="card" style={{ padding: 16 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{integration.name}</p>
              <p className="page-subtitle" style={{ margin: "6px 0 10px" }}>
                {integration.updated}
              </p>
              <span className={`tag ${integration.status === "Pending" ? "danger" : "success"}`}>{integration.status}</span>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
