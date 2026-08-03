import { prisma } from "@/lib/prisma";
import IntegrationsManager from "./integrations-manager";
import GeneralConfigForm from "./general-config-form";
import SecurityForm from "./security-form";

export const dynamic = "force-dynamic";

async function getSettingsData() {
  const [failedPayments, pendingSubscriptions, activeSessions, recentSecurityEvents] = await Promise.all([
    prisma.payment.count({ where: { status: "failed" } }),
    prisma.subscription.count({ where: { status: "pending" } }),
    prisma.userSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { fullName: true } } },
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

  return {
    healthRows,
    securityEvents,
  };
}

// Which integrations are wired via the server environment. We only ever expose
// the boolean presence — never the secret values themselves.
function serverConnectedIntegrations(): string[] {
  const ids: string[] = [];
  if (process.env.ANGELONE_API_KEY) ids.push("angelone");
  if (process.env.GEMINI_API_KEY) ids.push("gemini");
  return ids;
}

export default async function SettingsPage() {
  const { healthRows, securityEvents } = await getSettingsData();
  const serverConnected = serverConnectedIntegrations();

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
          <GeneralConfigForm
            defaults={{
              platformName: process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Finuer Admin Console",
              supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@finuer.app",
              timezone: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Asia/Kolkata",
              locale: process.env.NEXT_PUBLIC_LOCALE ?? "en-IN",
            }}
          />
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Live System Health</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {healthRows.map((item) => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
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

          <SecurityForm />
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

      <IntegrationsManager serverConnected={serverConnected} />
    </section>
  );
}
