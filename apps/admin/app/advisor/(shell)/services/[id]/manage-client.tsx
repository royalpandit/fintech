"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import { SERVICE_CATEGORIES, categoryLabel, yearlySavingsPct } from "@/lib/service-categories";

type Service = {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  yearlyPrice: number | null;
  hasTrial: boolean;
  trialDays: number;
  paused: boolean;
};
type Subscriber = { name: string; startDate: string; endDate: string | null; isTrial: boolean; status: string };
type Analytics = { total: number; active: number; activeTrials: number; monthlyRevenue: number; yearlyRevenue: number };

const TABS = ["Overview", "Subscribers", "Analytics", "Settings"] as const;
type Tab = (typeof TABS)[number];

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function ManageServiceClient({
  service,
  subscribers,
  analytics,
}: {
  service: Service;
  subscribers: Subscriber[];
  analytics: Analytics;
}) {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <section>
      <Link href="/advisor/services" className="user-page-back-link" style={{ marginBottom: 8 }}>
        <span className="user-page-back-icon"><FiArrowLeft size={14} /></span>
        Subscription Services
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 className="page-title" style={{ margin: 0 }}>{service.name}</h1>
        <span className="svc-badge" style={{ color: service.paused ? "#b45309" : "#047857", background: service.paused ? "rgba(245,158,11,0.14)" : "rgba(16,185,129,0.14)" }}>
          {service.paused ? "Paused" : "Active"}
        </span>
      </div>
      <p className="page-subtitle" style={{ marginTop: 0 }}>
        {categoryLabel(service.category)} · {inr(service.price)}/mo · {analytics.active} active subscribers
      </p>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", margin: "12px 0 18px" }}>
        {TABS.map((t) => (
          <button key={t} type="button" className={`svc-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <Overview service={service} analytics={analytics} />}
      {tab === "Subscribers" && <Subscribers subscribers={subscribers} />}
      {tab === "Analytics" && <AnalyticsTab service={service} analytics={analytics} />}
      {tab === "Settings" && <Settings service={service} activeCount={analytics.active} />}
    </section>
  );
}

function Overview({ service, analytics }: { service: Service; analytics: Analytics }) {
  const savings = yearlySavingsPct(service.price, service.yearlyPrice);
  const rows: [string, string][] = [
    ["Service Name", service.name],
    ["Category", categoryLabel(service.category)],
    ["Description", service.description || "—"],
    ["Monthly Price", inr(service.price)],
    ["Yearly Price", service.yearlyPrice != null ? `${inr(service.yearlyPrice)}${savings ? ` · save ${savings}%` : ""}` : "—"],
    ["Free Trial", service.hasTrial ? `${service.trialDays}-day trial` : "Off"],
    ["Subscriber Count", `${analytics.active} active`],
    ["Status", service.paused ? "Paused" : "Active"],
  ];
  return (
    <article className="card">
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 14 }}>
            <span style={{ color: "var(--text-muted)" }}>{k}</span>
            <span style={{ color: "var(--text)", fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{v}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function Subscribers({ subscribers }: { subscribers: Subscriber[] }) {
  if (subscribers.length === 0) {
    return <article className="card" style={{ textAlign: "center", color: "var(--text-muted)" }}>No subscribers yet.</article>;
  }
  return (
    <article className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Subscriber</th><th>Start</th><th>Expiry</th><th>Status</th></tr>
          </thead>
          <tbody>
            {subscribers.map((s, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>
                  {s.name}
                  {s.isTrial && <span className="svc-badge" style={{ marginLeft: 8, color: "#0ea5e9", background: "rgba(14,165,233,0.12)" }}>TRIAL</span>}
                </td>
                <td>{fmt(s.startDate)}</td>
                <td>{fmt(s.endDate)}</td>
                <td>
                  <span style={{ color: s.status === "Active" ? "#16a34a" : s.status === "Expired" ? "#b45309" : "#dc2626", fontWeight: 600, fontSize: 13 }}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function AnalyticsTab({ service, analytics }: { service: Service; analytics: Analytics }) {
  const tiles = [
    { label: "Total Subscribers", value: analytics.total.toLocaleString() },
    { label: "Active", value: analytics.active.toLocaleString() },
    { label: "Monthly Revenue", value: inr(analytics.monthlyRevenue) },
    { label: "Yearly Revenue", value: inr(analytics.yearlyRevenue) },
    { label: "Active Trials", value: analytics.activeTrials.toLocaleString() },
    { label: "Renewal Rate", value: "—" },
  ];
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {tiles.map((t) => (
          <article key={t.label} className="card">
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{t.label}</p>
            <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{t.value}</p>
          </article>
        ))}
      </div>
      <p style={{ margin: "12px 2px 0", fontSize: 11, color: "var(--text-muted)" }}>
        Revenue is a live snapshot (active subscribers × {inr(service.price)}). Renewal rate needs billing-cycle
        history, which isn&apos;t tracked yet.
      </p>
    </>
  );
}

function Settings({ service, activeCount }: { service: Service; activeCount: number }) {
  const router = useRouter();
  const [name, setName] = useState(service.name);
  const [category, setCategory] = useState(service.category ?? "");
  const [description, setDescription] = useState(service.description ?? "");
  const [monthly, setMonthly] = useState(String(service.price));
  const [yearly, setYearly] = useState(service.yearlyPrice != null ? String(service.yearlyPrice) : "");
  const [hasTrial, setHasTrial] = useState(service.hasTrial);
  const [paused, setPaused] = useState(service.paused);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true); setError(""); setMsg("");
    try {
      const res = await fetch(`/api/v1/advisor/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category || undefined,
          description,
          price: Number(monthly),
          yearlyPrice: yearly ? Number(yearly) : null,
          hasTrial,
          paused,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) setError(data.error || "Failed to save");
      else { setMsg("Saved."); router.refresh(); }
    } finally { setSaving(false); }
  }

  async function remove() {
    const warn = activeCount > 0
      ? `This service has ${activeCount} active subscriber(s). Delete anyway?`
      : "Delete this service?";
    if (!confirm(warn)) return;
    const res = await fetch(`/api/v1/advisor/services/${service.id}?force=true`, { method: "DELETE" });
    if (res.ok) router.push("/advisor/services");
    else alert("Failed to delete");
  }

  return (
    <article className="card">
      <h3 style={{ marginTop: 0 }}>Settings</h3>
      <label className="metric-label">Service Name</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />

      <label className="metric-label" style={{ marginTop: 14 }}>Category</label>
      <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">Select…</option>
        {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
      </select>

      <label className="metric-label" style={{ marginTop: 14 }}>Description</label>
      <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: "vertical" }} />

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div>
          <label className="metric-label">Monthly Price ₹</label>
          <input className="input" type="number" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </div>
        <div>
          <label className="metric-label">Yearly Price ₹</label>
          <input className="input" type="number" min={0} value={yearly} onChange={(e) => setYearly(e.target.value)} />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        <input type="checkbox" checked={hasTrial} onChange={(e) => setHasTrial(e.target.checked)} /> Offer 7-Day Free Trial
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> Pause new subscriptions
      </label>

      {error && <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 12 }}>{error}</p>}
      {msg && <p style={{ color: "#047857", fontSize: 13, marginTop: 12 }}>{msg}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
        <button type="button" onClick={remove} style={{ border: "1px solid rgba(220,38,38,0.4)", background: "transparent", color: "#dc2626", padding: "10px 16px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Delete Service
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </article>
  );
}
