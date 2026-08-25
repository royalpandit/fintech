import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sweepSubscriptionLifecycle } from "@/lib/subscription-sweep";
import { sweepFinuerProLifecycle } from "@/lib/finuer-pro-sweep";
import { requireAuthToken } from "@/lib/auth";
import { categoryLabel, isSubscriptionActive } from "@/lib/subscription-services";
import SubscriptionsBrowser, {
  type PurchaseRow,
  type SubRow,
} from "@/components/subscriptions/subscriptions-browser";
import FinuerProSection from "@/components/subscriptions/finuer-pro-section";
import { getFinuerProStatus, listPurchasableFinuerPlans } from "@/lib/finuer-pro";

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

  // Warn about anything lapsing, and flip what already has. The nightly cron
  // covers members who never open this page; this catches the ones who do.
  await Promise.all([
    sweepSubscriptionLifecycle(auth.userId),
    sweepFinuerProLifecycle(auth.userId),
  ]);

  // Finuer Pro — the platform plan. Rendered inline at the top of this page
  // rather than behind its own tab; #finuer-pro is what the premium-basket
  // lock CTAs link to.
  const [proPlans, proStatus] = await Promise.all([
    listPurchasableFinuerPlans(),
    getFinuerProStatus(auth.userId, auth.role),
  ]);

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

  // Serialize the two lists for the client-side search/filter browser.
  const subRows: SubRow[] = [
    ...serviceSubscriptions.map((s): SubRow => {
      const active = isSubscriptionActive(s);
      const exp = expiryInfo(s.endDate);
      return {
        key: `svc-${s.id}`,
        kind: "service",
        id: s.id,
        title: s.service.name,
        advisorName: s.service.advisor.fullName,
        advisorId: s.service.advisor.id,
        meta: [
          s.service.category ? categoryLabel(s.service.category) : "",
          s.isTrial ? "Free trial" : "Plan",
          formatINR(Number(s.service.price)),
        ]
          .filter(Boolean)
          .join(" · "),
        description: s.service.description ?? null,
        active,
        status: s.status,
        expText: exp.text,
        expTone: exp.expired ? "expired" : exp.soon ? "soon" : "muted",
        showExp: active || exp.expired,
      };
    }),
    ...legacySubscriptions.map((s): SubRow => {
      const active = isSubscriptionActive(s);
      const exp = expiryInfo(s.endDate);
      return {
        key: `adv-${s.id}`,
        kind: "advisor",
        id: s.id,
        title: "Advisor subscription",
        advisorName: s.advisor.fullName,
        advisorId: s.advisor.id,
        meta: formatINR(Number(s.amount)),
        description: null,
        active,
        status: s.status,
        expText: exp.text,
        expTone: exp.expired ? "expired" : exp.soon ? "soon" : "muted",
        showExp: active || exp.expired,
      };
    }),
  ];

  const purchaseRows: PurchaseRow[] = purchases.map((p) => ({
    id: p.id,
    title: p.post.title || p.post.marketSymbol || "Unlocked post",
    advisorName: p.post.advisor?.fullName ?? "—",
    marketSymbol: p.post.marketSymbol,
    unlockedAt: fmtDate(p.unlockedAt),
    priceText: p.unlockPrice != null ? formatINR(Number(p.unlockPrice)) : "Unlocked",
  }));

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

      <FinuerProSection
        plans={proPlans.map((p) => ({
          id: p.id,
          label: p.label,
          tagline: p.tagline,
          priceInr: p.priceInr,
          durationDays: p.durationDays,
          features: p.features,
          badge: p.badge,
        }))}
        status={{
          active: proStatus.active,
          planId: proStatus.planId,
          planLabel: proStatus.plan.label,
          expiresAt: proStatus.expiresAt,
          viaRole: proStatus.viaRole,
        }}
      />

      <div className="subs-grid">
        <SubscriptionsBrowser subs={subRows} purchases={purchaseRows} />

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
