import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { categoryLabel, isSubscriptionActive } from "@/lib/subscription-services";

export const dynamic = "force-dynamic";

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function UserSubscriptionsPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: auth.userId },
    orderBy: { startDate: "desc" },
    include: {
      advisor: {
        select: {
          id: true,
          fullName: true,
          advisorProfile: { select: { sebiRegistrationNo: true } },
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          category: true,
          monthlyPrice: true,
          yearlyPrice: true,
        },
      },
    },
  });

  const availableServices = (
    await prisma.advisorSubscriptionService.findMany({
      where: { deletedAt: null, status: "active", pauseNewSubscriptions: false },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        advisor: { select: { id: true, fullName: true } },
      },
    })
  ).filter((svc) => svc.advisor);

  const subscribedServiceIds = new Set(
    subscriptions
      .filter((s) => s.serviceId && isSubscriptionActive(s))
      .map((s) => s.serviceId!),
  );

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: -0.5 }}>
          My Subscriptions
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          Plans you&apos;ve subscribed to and available advisor services
        </p>
      </div>

      <article className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Active & past subscriptions</h3>
        {subscriptions.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
            You haven&apos;t subscribed to any plan yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {subscriptions.map((s) => {
              const active = isSubscriptionActive(s);
              return (
                <div
                  key={s.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 14,
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong>{s.service?.name ?? "Advisor subscription"}</strong>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        Advisor:{" "}
                        <Link href={`/user/advisors/${s.advisor.id}`} style={{ color: "#0ea5e9" }}>
                          {s.advisor.fullName}
                        </Link>
                        {s.service ? ` · ${categoryLabel(s.service.category)}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        {s.isTrial ? "Trial" : s.planType ?? "plan"} · {formatINR(Number(s.amount))}
                        {s.endDate ? ` · until ${new Date(s.endDate).toLocaleDateString("en-IN")}` : ""}
                      </div>
                    </div>
                    <span
                      style={{
                        alignSelf: "flex-start",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: active ? "#d1fae5" : "#f1f5f9",
                        color: active ? "#047857" : "#64748b",
                      }}
                    >
                      {active ? "Active" : s.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>

      <article className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Browse advisor plans</h3>
          <Link href="/user/advisors" className="btn-primary" style={{ padding: "8px 14px", fontSize: 12 }}>
            All professionals
          </Link>
        </div>
        {availableServices.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)" }}>No subscription services available yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {availableServices.map((svc) => (
              <div
                key={svc.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <strong>{svc.name}</strong>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {svc.advisor!.fullName} · {categoryLabel(svc.category)} · {formatINR(Number(svc.monthlyPrice))}/mo
                  </div>
                </div>
                {subscribedServiceIds.has(svc.id) ? (
                  <span style={{ fontSize: 12, color: "#047857", fontWeight: 600 }}>Subscribed</span>
                ) : (
                  <Link
                    href={`/user/advisors/${svc.advisor!.id}`}
                    className="btn-primary"
                    style={{ padding: "8px 14px", fontSize: 12 }}
                  >
                    View & Subscribe
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
