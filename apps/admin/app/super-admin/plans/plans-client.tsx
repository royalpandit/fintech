"use client";

import { useCallback, useEffect, useState } from "react";

type Plan = {
  id: string;
  label: string;
  priceInr: number;
  durationDays: number | null;
  features: string[];
  unlocksPremiumBaskets: boolean;
};

type Member = {
  userId: number;
  fullName: string;
  email: string;
  role: string;
  planId: string | null;
  planLabel: string | null;
  expiresAt: string | null;
};

export default function FinuerProPlansClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [planId, setPlanId] = useState("pro_monthly");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/admin/finuer-pro");
    const j = await res.json();
    if (j.ok || j.status) {
      setPlans(j.plans ?? []);
      setMembers(j.members ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function grant() {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/v1/admin/finuer-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant", email: email.trim(), planId, days }),
      });
      const j = await res.json();
      if (!(j.ok || j.status)) throw new Error(j.error || "Grant failed");
      setMsg(`Granted ${planId} until ${new Date(j.expiresAt).toLocaleDateString("en-IN")}`);
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: number) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/admin/finuer-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", userId }),
      });
      const j = await res.json();
      if (!(j.ok || j.status)) throw new Error(j.error || "Revoke failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Finuer Pro Plans</h1>
        <p className="page-subtitle">
          Define platform plans and manually grant Pro (unlocks premium Finuer Baskets). Razorpay billing can be wired later.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontSize: 13 }}>
          {error}
        </div>
      )}
      {msg && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#d1fae5", color: "#047857", fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 28 }}>
        {plans.map((p) => (
          <article
            key={p.id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>{p.label}</h3>
            <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
              ₹{p.priceInr.toLocaleString("en-IN")}
              {p.durationDays ? <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}> / {p.durationDays}d</span> : null}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <article style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 15 }}>Grant Finuer Pro</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
            User email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              style={{ height: 38, minWidth: 220, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
            Plan
            <select
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                const p = plans.find((x) => x.id === e.target.value);
                if (p?.durationDays) setDays(p.durationDays);
              }}
              style={{ height: 38, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            >
              {plans.filter((p) => p.unlocksPremiumBaskets).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
            Days
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 30)}
              style={{ height: 38, width: 90, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </label>
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={grant}
            className="theme-btn-primary"
            style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer" }}
          >
            {busy ? "Saving…" : "Grant Pro"}
          </button>
        </div>
      </article>

      <article style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Active Pro members ({members.length})</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "left", fontSize: 11 }}>
                <th style={{ padding: "10px 16px" }}>User</th>
                <th style={{ padding: "10px 16px" }}>Plan</th>
                <th style={{ padding: "10px 16px" }}>Expires</th>
                <th style={{ padding: "10px 16px" }} />
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                    No active Pro grants yet.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.userId} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600 }}>{m.fullName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.email}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>{m.planLabel}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {m.expiresAt ? new Date(m.expiresAt).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => revoke(m.userId)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--surface-2)",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Revoke
                      </button>
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
