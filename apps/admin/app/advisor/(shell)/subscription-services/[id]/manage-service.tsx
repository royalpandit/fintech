"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SERVICE_CATEGORIES } from "@/lib/subscription-services";

type Tab = "overview" | "subscribers" | "analytics" | "settings";

type ServiceData = {
  id: number;
  name: string;
  category: string;
  categoryLabel: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlySavingsPct: number;
  offerFreeTrial: boolean;
  status: string;
  pauseNewSubscriptions: boolean;
  subscriberCount: number;
};

type SubscriberRow = {
  id: number;
  user: { id: number; fullName: string; email: string };
  planType: string | null;
  isTrial: boolean;
  status: string;
  amount: number;
  startDate: string;
  endDate: string | null;
};

type Analytics = {
  totalSubscribers: number;
  activeSubscribers: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  totalRevenue: number;
  activeTrials: number;
  renewalRate: number;
};

export default function ManageSubscriptionService({
  initialService,
  initialSubscribers,
  initialAnalytics,
}: {
  initialService: ServiceData;
  initialSubscribers: SubscriberRow[];
  initialAnalytics: Analytics;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [service, setService] = useState(initialService);
  const [subscribers] = useState(initialSubscribers);
  const [analytics] = useState(initialAnalytics);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description);
  const [monthlyPrice, setMonthlyPrice] = useState(String(service.monthlyPrice));
  const [yearlyPrice, setYearlyPrice] = useState(String(service.yearlyPrice));
  const [offerFreeTrial, setOfferFreeTrial] = useState(service.offerFreeTrial);
  const [pauseNewSubscriptions, setPauseNewSubscriptions] = useState(service.pauseNewSubscriptions);

  async function patchService(body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/v1/advisor/subscription-services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) {
        setError(data.error || "Update failed");
        return;
      }
      setService(data.service);
      setMessage("Saved successfully");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    await patchService({
      name: name.trim(),
      description: description.trim(),
      monthlyPrice: Number(monthlyPrice),
      yearlyPrice: Number(yearlyPrice),
      offerFreeTrial,
      pauseNewSubscriptions,
    });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "subscribers", label: "Subscribers" },
    { id: "analytics", label: "Analytics" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <section>
      <Link href="/advisor/subscription-services" className="page-subtitle" style={{ marginTop: 0, display: "inline-block" }}>
        ← Subscription Services
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, marginTop: 8 }}>
        <div>
          <h1 className="page-title">{service.name}</h1>
          <p className="page-subtitle">
            {service.categoryLabel} · {service.subscriberCount} subscribers ·{" "}
            <span style={{ color: service.status === "active" ? "#047857" : "#92400e", fontWeight: 600 }}>
              {service.status}
            </span>
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: tab === t.id ? "1px solid #0ea5e9" : "1px solid var(--border)",
              background: tab === t.id ? "rgba(14,165,233,0.1)" : "var(--surface)",
              color: tab === t.id ? "#0369a1" : "var(--text)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <article className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Service Overview</h3>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p className="metric-label">Service Name</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{service.name}</p>
            </div>
            <div>
              <p className="metric-label">Category</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{service.categoryLabel}</p>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <p className="metric-label">Description</p>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{service.description}</p>
            </div>
            <div>
              <p className="metric-label">Monthly Price</p>
              <p style={{ margin: 0, fontWeight: 600 }}>₹{service.monthlyPrice.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="metric-label">Yearly Price</p>
              <p style={{ margin: 0, fontWeight: 600 }}>
                ₹{service.yearlyPrice.toLocaleString("en-IN")}
                {service.yearlySavingsPct > 0 ? ` (Save ${service.yearlySavingsPct}%)` : ""}
              </p>
            </div>
            <div>
              <p className="metric-label">Subscriber Count</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{service.subscriberCount}</p>
            </div>
            <div>
              <p className="metric-label">Status</p>
              <p style={{ margin: 0, fontWeight: 600, textTransform: "capitalize" }}>{service.status}</p>
            </div>
          </div>
        </article>
      )}

      {tab === "subscribers" && (
        <article className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Subscribers</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Start</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ color: "var(--text-muted)" }}>No subscribers yet.</td>
                  </tr>
                ) : (
                  subscribers.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.user.fullName}</strong>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.user.email}</div>
                      </td>
                      <td>{s.isTrial ? "Trial" : s.planType ?? "—"}</td>
                      <td>{new Date(s.startDate).toLocaleDateString()}</td>
                      <td>{s.endDate ? new Date(s.endDate).toLocaleDateString() : "—"}</td>
                      <td style={{ textTransform: "capitalize" }}>{s.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {tab === "analytics" && (
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          {[
            { label: "Total Subscribers", value: analytics.totalSubscribers },
            { label: "Active Subscribers", value: analytics.activeSubscribers },
            { label: "Monthly Revenue", value: `₹${analytics.monthlyRevenue.toLocaleString("en-IN")}` },
            { label: "Yearly Revenue", value: `₹${analytics.yearlyRevenue.toLocaleString("en-IN")}` },
            { label: "Total Revenue", value: `₹${analytics.totalRevenue.toLocaleString("en-IN")}` },
            { label: "Active Trials", value: analytics.activeTrials },
            { label: "Renewal Rate", value: `${analytics.renewalRate}%` },
          ].map((m) => (
            <article key={m.label} className="card">
              <p className="metric-label">{m.label}</p>
              <p className="metric-value" style={{ fontSize: 28 }}>{m.value}</p>
            </article>
          ))}
        </div>
      )}

      {tab === "settings" && (
        <article className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Settings</h3>
          <form onSubmit={saveSettings}>
            <label className="metric-label">Service Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />

            <label className="metric-label" style={{ marginTop: 12 }}>Description</label>
            <textarea className="input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />

            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <label className="metric-label">Monthly Price (₹)</label>
                <input className="input" type="number" min={0} value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} required />
              </div>
              <div>
                <label className="metric-label">Yearly Price (₹)</label>
                <input className="input" type="number" min={0} value={yearlyPrice} onChange={(e) => setYearlyPrice(e.target.value)} required />
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={offerFreeTrial} onChange={(e) => setOfferFreeTrial(e.target.checked)} />
              <span>Enable 7-Day Free Trial</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={pauseNewSubscriptions} onChange={(e) => setPauseNewSubscriptions(e.target.checked)} />
              <span>Pause New Subscriptions</span>
            </label>

            {error && <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 12 }}>{error}</p>}
            {message && <p style={{ color: "#047857", fontSize: 13, marginTop: 12 }}>{message}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              {service.status === "active" ? (
                <button type="button" className="input" style={{ width: "auto", padding: "12px 20px" }} disabled={saving} onClick={() => patchService({ status: "paused" })}>
                  Pause Service
                </button>
              ) : (
                <button type="button" className="btn-primary" style={{ background: "#047857" }} disabled={saving} onClick={() => patchService({ status: "active" })}>
                  Activate Service
                </button>
              )}
              <button
                type="button"
                style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #fca5a5", background: "rgba(239,68,68,0.08)", color: "#b91c1c", cursor: "pointer" }}
                disabled={saving}
                onClick={async () => {
                  if (!confirm("Delete this service? Only possible if no active subscribers.")) return;
                  const res = await fetch(`/api/v1/advisor/subscription-services/${service.id}`, { method: "DELETE" });
                  const data = await res.json();
                  if (res.ok) router.push("/advisor/subscription-services");
                  else setError(data.error || "Delete failed");
                }}
              >
                Delete Service
              </button>
            </div>
          </form>
        </article>
      )}
    </section>
  );
}
