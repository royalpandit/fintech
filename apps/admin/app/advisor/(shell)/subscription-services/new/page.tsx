"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SERVICE_CATEGORIES } from "@/lib/subscription-services";

export default function NewSubscriptionServicePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("stocks");
  const [description, setDescription] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [yearlyPrice, setYearlyPrice] = useState("");
  const [offerFreeTrial, setOfferFreeTrial] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const monthly = Number(monthlyPrice) || 0;
  const yearly = Number(yearlyPrice) || 0;
  const savings =
    monthly > 0 && yearly > 0 && monthly * 12 > yearly
      ? Math.round(((monthly * 12 - yearly) / (monthly * 12)) * 100)
      : 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/advisor/subscription-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          description: description.trim(),
          monthlyPrice: Number(monthlyPrice),
          yearlyPrice: Number(yearlyPrice),
          offerFreeTrial,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed to create service");
        setLoading(false);
        return;
      }
      router.push(`/advisor/subscription-services/${data.service.id}`);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <section>
      <Link href="/advisor/subscription-services" className="page-subtitle" style={{ marginTop: 0, display: "inline-block" }}>
        ← Subscription Services
      </Link>
      <h1 className="page-title">Create New Service</h1>
      <p className="page-subtitle">
        Set up a subscription service for a specific market or trading strategy.
      </p>

      <form onSubmit={submit}>
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16, alignItems: "start" }}>
          <article className="card">
            <h3 style={{ marginTop: 0 }}>1. Basic Details</h3>

            <label className="metric-label">Service Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Commodity Trading"
              required
              minLength={3}
            />

            <label className="metric-label" style={{ marginTop: 16 }}>Category *</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} required>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            <label className="metric-label" style={{ marginTop: 16 }}>Description *</label>
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              required
              minLength={20}
              placeholder="What subscribers receive, trading style, holding period, who it's for..."
              style={{ resize: "vertical" }}
            />

            <h3 style={{ marginTop: 24 }}>2. Pricing</h3>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={offerFreeTrial}
                onChange={(e) => setOfferFreeTrial(e.target.checked)}
              />
              <span style={{ fontSize: 14 }}>Offer 7-Day Free Trial</span>
            </label>

            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="metric-label">Monthly Price (₹) *</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="1"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  placeholder="999"
                  required
                />
              </div>
              <div>
                <label className="metric-label">Yearly Price (₹) *</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="1"
                  value={yearlyPrice}
                  onChange={(e) => setYearlyPrice(e.target.value)}
                  placeholder="9999"
                  required
                />
              </div>
            </div>

            {monthly > 0 && yearly > 0 && (
              <p style={{ marginTop: 10, fontSize: 13, color: "var(--text-muted)" }}>
                ₹{monthly.toLocaleString("en-IN")}/month · ₹{yearly.toLocaleString("en-IN")}/year
                {savings > 0 ? ` · Save ${savings}%` : ""}
              </p>
            )}

            {error && (
              <div style={{ marginTop: 16, padding: "10px 12px", background: "rgba(239,68,68,0.12)", color: "#b91c1c", borderRadius: 10, fontSize: 14 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <Link href="/advisor/subscription-services" className="input" style={{ width: "auto", padding: "12px 20px", textDecoration: "none", color: "inherit" }}>
                Cancel
              </Link>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Creating..." : "Create Service"}
              </button>
            </div>
          </article>

          <article className="card">
            <h3 style={{ marginTop: 0 }}>After creation</h3>
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--text)" }}>
              <li>Dedicated subscriber list</li>
              <li>Broadcast audience for posts</li>
              <li>Private chat access for subscribers</li>
              <li>Revenue tracking & analytics</li>
              <li>Manage via Overview, Subscribers, Analytics, Settings</li>
            </ul>
          </article>
        </div>
      </form>
    </section>
  );
}
