import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import { categoryLabel, isSubscriptionActive } from "@/lib/subscription-services";
import SubscriptionActions from "@/components/subscriptions/subscription-actions";

export const dynamic = "force-dynamic";

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Human expiry status with an "expiring soon" flag (≤ 7 days). */
function expiryInfo(endDate: Date | string | null | undefined) {
  if (!endDate) return { text: "No expiry", soon: false, expired: false };
  const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: `Expired · ${fmtDate(endDate)}`, soon: false, expired: true };
  if (days === 0) return { text: "Expires today", soon: true, expired: false };
  return {
    text: `${days} day${days > 1 ? "s" : ""} left · until ${fmtDate(endDate)}`,
    soon: days <= 7,
    expired: false,
  };
}

export default async function UserSubscriptionsPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  // Per-service subscriptions (new model)
  const serviceSubscriptions = await prisma.serviceSubscription.findMany({
    where: { userId: auth.userId },
    orderBy: { startDate: "desc" },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          price: true,
          yearlyPrice: true,
          advisor: { select: { id: true, fullName: true } },
        },
      },
    },
  });

  // Legacy advisor-level subscriptions
  const legacySubscriptions = await prisma.subscription.findMany({
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
    },
  });

  // One-time purchases — paid trades / posts the user unlocked individually.
  const purchases = await prisma.marketPostUnlock.findMany({
    where: { userId: auth.userId },
    orderBy: { unlockedAt: "desc" },
    take: 40,
    include: {
      post: {
        select: {
          id: true,
          title: true,
          marketSymbol: true,
          advisor: { select: { id: true, fullName: true } },
        },
      },
    },
  });

  const availableServices = await prisma.subscriptionService.findMany({
    where: { isActive: true, paused: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: 12,
    include: {
      advisor: { select: { id: true, fullName: true } },
    },
  });

  const subscribedServiceIds = new Set(
    serviceSubscriptions.filter((s) => isSubscriptionActive(s)).map((s) => s.serviceId),
  );

  const activeCount =
    serviceSubscriptions.filter((s) => isSubscriptionActive(s)).length +
    legacySubscriptions.filter((s) => isSubscriptionActive(s)).length;

  return (
    <section>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: -0.5 }}>
          Subscriptions &amp; Purchases
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
          {activeCount > 0 ? `${activeCount} active` : "No active plans"} · services you subscribe to and
          one-time trades you&apos;ve unlocked
        </p>
      </div>

      <div className="subs-grid">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <article className="card">
            <h3 style={{ marginTop: 0 }}>Active &amp; past subscriptions</h3>
            {serviceSubscriptions.length === 0 && legacySubscriptions.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
                You haven&apos;t subscribed to any plan yet.
              </p>
            ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {serviceSubscriptions.map((s) => {
              const active = isSubscriptionActive(s);
              const exp = expiryInfo(s.endDate);
              return (
                <div
                  key={s.id}
                  style={{
                    border: `1px solid ${exp.soon && active ? "#f59e0b" : "var(--border)"}`,
                    borderRadius: 12,
                    padding: 14,
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <strong>{s.service.name}</strong>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        {s.service.advisor.fullName}
                        {s.service.category ? ` · ${categoryLabel(s.service.category)}` : ""}
                        {" · "}
                        {s.isTrial ? "Free trial" : "Plan"} · {formatINR(Number(s.service.price))}
                      </div>
                      {s.service.description && (
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                          {s.service.description}
                        </p>
                      )}
                      <div
                        style={{
                          fontSize: 12,
                          marginTop: 6,
                          fontWeight: 600,
                          color: exp.expired ? "#64748b" : exp.soon ? "#b45309" : "var(--text-muted)",
                        }}
                      >
                        {active || exp.expired ? exp.text : ""}
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
                  <div style={{ marginTop: 12 }}>
                    <SubscriptionActions subscriptionId={s.id} active={active} />
                  </div>
                </div>
              );
            })}
            {legacySubscriptions.map((s) => {
              const active = isSubscriptionActive(s);
              const exp = expiryInfo(s.endDate);
              return (
                <div
                  key={`legacy-${s.id}`}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 14,
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong>Advisor subscription</strong>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                        <Link href={`/user/advisors/${s.advisor.id}`} style={{ color: "#0ea5e9" }}>
                          {s.advisor.fullName}
                        </Link>
                        {" · "}
                        {formatINR(Number(s.amount))}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: "var(--text-muted)" }}>
                        {active || exp.expired ? exp.text : ""}
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
                  <div style={{ marginTop: 12 }}>
                    <SubscriptionActions subscriptionId={s.id} active={active} kind="advisor" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>

      <article className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>One-time purchases</h3>
        {purchases.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
            No individual unlocks yet. Paid trades and posts you unlock will appear here — yours forever, no expiry.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {purchases.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Link href={`/user/trades`} style={{ fontWeight: 600, color: "var(--text)" }}>
                    {p.post.title || p.post.marketSymbol || "Unlocked post"}
                  </Link>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    {p.post.advisor?.fullName ?? "—"}
                    {p.post.marketSymbol ? ` · ${p.post.marketSymbol}` : ""}
                    {" · unlocked "}
                    {fmtDate(p.unlockedAt)}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#047857", whiteSpace: "nowrap" }}>
                  {p.unlockPrice != null ? formatINR(Number(p.unlockPrice)) : "Unlocked"}
                </span>
              </div>
            ))}
          </div>
        )}
          </article>
        </div>

        <div className="subs-side">
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
                    {svc.advisor.fullName}
                    {svc.category ? ` · ${categoryLabel(svc.category)}` : ""}
                    {" · "}
                    {formatINR(Number(svc.price))}/mo
                  </div>
                </div>
                {subscribedServiceIds.has(svc.id) ? (
                  <span style={{ fontSize: 12, color: "#047857", fontWeight: 600 }}>Subscribed</span>
                ) : (
                  <Link
                    href={`/user/advisors/${svc.advisor.id}`}
                    className="btn-primary"
                    style={{ padding: "8px 14px", fontSize: 12 }}
                  >
                    View &amp; Subscribe
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
          </article>
        </div>
      </div>
    </section>
  );
}
