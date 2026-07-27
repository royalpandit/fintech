"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiUsers, FiPlus, FiX } from "react-icons/fi";
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
  isBundle: boolean;
  subscriberCount: number;
};

export default function ServicesClient({ initialServices }: { initialServices: Service[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button type="button" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => setOpen(true)}>
          <FiPlus size={15} /> Create New Service
        </button>
      </div>

      {initialServices.length === 0 ? (
        <article className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ margin: 0, fontSize: 14 }}>No services yet.</p>
          <p style={{ margin: "6px 0 0", fontSize: 13 }}>Create your first plan to start earning from subscribers.</p>
        </article>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {initialServices.map((s) => (
            <article key={s.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 16, color: "var(--text)" }}>{s.name}</strong>
                    {s.isBundle && <span className="svc-badge" style={{ color: "#7c3aed", background: "rgba(124,58,237,0.12)" }}>BUNDLE</span>}
                  </div>
                  {s.category && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{categoryLabel(s.category)}</div>}
                </div>
                <span
                  className="svc-badge"
                  style={{
                    color: s.paused ? "#b45309" : "#047857",
                    background: s.paused ? "rgba(245,158,11,0.14)" : "rgba(16,185,129,0.14)",
                  }}
                >
                  {s.paused ? "Paused" : "Active"}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>₹{s.price.toLocaleString("en-IN")}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/month</span>
                {s.hasTrial && <span style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 600 }}>· {s.trialDays}-day trial</span>}
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FiUsers size={13} /> {s.subscriberCount.toLocaleString()} subscribers
              </div>

              <Link
                href={`/advisor/services/${s.id}`}
                style={{ marginTop: 6, textAlign: "center", padding: "9px 14px", borderRadius: 10, background: "var(--surface-2)", color: "var(--text)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
              >
                Manage
              </Link>
            </article>
          ))}
        </div>
      )}

      {open && <CreateServiceModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); router.refresh(); }} />}
    </>
  );
}

function CreateServiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [monthly, setMonthly] = useState("");
  const [yearly, setYearly] = useState("");
  const [hasTrial, setHasTrial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const savings = yearlySavingsPct(Number(monthly) || 0, yearly ? Number(yearly) : null);

  async function submit() {
    setError("");
    if (!name.trim() || name.trim().length < 2) return setError("Enter a service name.");
    if (!category) return setError("Pick a category.");
    if (!description.trim()) return setError("Add a description.");
    if (!monthly || Number(monthly) <= 0) return setError("Enter a valid monthly price.");
    setSaving(true);
    try {
      const res = await fetch("/api/v1/advisor/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          description: description.trim(),
          price: Number(monthly),
          yearlyPrice: yearly ? Number(yearly) : undefined,
          hasTrial,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) return setError(data.error || "Failed to create service");
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bc-overlay" role="dialog" aria-label="Create service" onClick={onClose}>
      <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
        <header className="bc-head">
          <h3>Create New Service</h3>
          <button type="button" className="bc-close" onClick={onClose} aria-label="Close"><FiX size={18} /></button>
        </header>
        <div className="bc-body">
          <div>
            <label className="metric-label">Service Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Commodity Trading" />
          </div>
          <div>
            <label className="metric-label">Category *</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select…</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="metric-label">Description *</label>
            <textarea className="bc-textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What subscribers receive, trading style, holding period, who it suits…" />
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="metric-label">Monthly Price ₹ *</label>
              <input className="input" type="number" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="999" />
            </div>
            <div>
              <label className="metric-label">Yearly Price ₹</label>
              <input className="input" type="number" min={0} value={yearly} onChange={(e) => setYearly(e.target.value)} placeholder="9999" />
            </div>
          </div>
          {savings > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Yearly saves {savings}% vs monthly.</p>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={hasTrial} onChange={(e) => setHasTrial(e.target.checked)} />
            Offer 7-Day Free Trial
          </label>

          {error && <p className="bc-error">{error}</p>}
        </div>
        <footer className="bc-foot">
          <button type="button" className="bc-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="bc-send" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create Service"}
          </button>
        </footer>
      </div>
    </div>
  );
}
