import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { categoryLabel, serializeService } from "@/lib/subscription-services";

export const dynamic = "force-dynamic";

function statusTag(status: string) {
  const colors: Record<string, { bg: string; fg: string }> = {
    active: { bg: "#d1fae5", fg: "#047857" },
    paused: { bg: "#fef3c7", fg: "#92400e" },
    deleted: { bg: "#fee2e2", fg: "#991b1b" },
  };
  const s = colors[status] ?? colors.active;
  return (
    <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}

export default async function AdvisorSubscriptionServicesPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const services = await prisma.advisorSubscriptionService.findMany({
    where: { advisorUserId: auth.userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          subscriptions: { where: { status: "active", endDate: { gt: new Date() } } },
        },
      },
    },
  });

  const totalRevenue = await prisma.subscription.aggregate({
    where: { advisorUserId: auth.userId, serviceId: { not: null } },
    _sum: { amount: true },
  });

  const serialized = services.map(serializeService);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
        <div>
          <h1 className="page-title">Subscription Services</h1>
          <p className="page-subtitle">
            Create services for different markets or strategies — stocks, options, crypto, and more.
          </p>
        </div>
        <Link href="/advisor/subscription-services/new" className="btn-primary" style={{ padding: "12px 20px" }}>
          + Create New Service
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <article className="card">
          <p className="metric-label">Total Services</p>
          <p className="metric-value" style={{ fontSize: 34 }}>{services.length}</p>
        </article>
        <article className="card">
          <p className="metric-label">Active Services</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {services.filter((s) => s.status === "active").length}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Total Subscribers</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            {serialized.reduce((sum, s) => sum + s.subscriberCount, 0)}
          </p>
        </article>
        <article className="card">
          <p className="metric-label">Total Revenue</p>
          <p className="metric-value" style={{ fontSize: 34 }}>
            ₹{Number(totalRevenue._sum.amount ?? 0).toLocaleString("en-IN")}
          </p>
        </article>
      </div>

      <article className="card" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th>Pricing</th>
                <th>Subscribers</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {serialized.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--text-muted)" }}>
                    No services yet. Create your first subscription service.
                  </td>
                </tr>
              ) : (
                serialized.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      {s.offerFreeTrial && (
                        <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>7-day trial</div>
                      )}
                    </td>
                    <td>{categoryLabel(s.category)}</td>
                    <td>
                      ₹{s.monthlyPrice.toLocaleString("en-IN")}/mo
                      <br />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        ₹{s.yearlyPrice.toLocaleString("en-IN")}/yr
                        {s.yearlySavingsPct > 0 ? ` · Save ${s.yearlySavingsPct}%` : ""}
                      </span>
                    </td>
                    <td>{s.subscriberCount}</td>
                    <td>{statusTag(s.status)}</td>
                    <td>
                      <Link href={`/advisor/subscription-services/${s.id}`} className="btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}>
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
