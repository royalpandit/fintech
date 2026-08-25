"use client";

import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiX, FiCheck } from "react-icons/fi";

type Plan = {
  id: number;
  slug: string;
  label: string;
  tagline: string | null;
  priceInr: number;
  durationDays: number | null;
  features: string[];
  unlocksPremiumBaskets: boolean;
  isPurchasable: boolean;
  isActive: boolean;
  badge: string | null;
  sortOrder: number;
  updatedAt: string | null;
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

/** Editor state — features are edited as one textarea, one bullet per line. */
type Draft = {
  slug: string;
  label: string;
  tagline: string;
  priceInr: string;
  durationDays: string;
  featuresText: string;
  unlocksPremiumBaskets: boolean;
  isPurchasable: boolean;
  isActive: boolean;
  badge: string;
  sortOrder: string;
};

const BLANK: Draft = {
  slug: "",
  label: "",
  tagline: "",
  priceInr: "0",
  durationDays: "30",
  featuresText: "",
  unlocksPremiumBaskets: true,
  isPurchasable: true,
  isActive: true,
  badge: "",
  sortOrder: "10",
};

function toDraft(p: Plan): Draft {
  return {
    slug: p.slug,
    label: p.label,
    tagline: p.tagline ?? "",
    priceInr: String(p.priceInr),
    durationDays: p.durationDays == null ? "" : String(p.durationDays),
    featuresText: p.features.join("\n"),
    unlocksPremiumBaskets: p.unlocksPremiumBaskets,
    isPurchasable: p.isPurchasable,
    isActive: p.isActive,
    badge: p.badge ?? "",
    sortOrder: String(p.sortOrder),
  };
}

const inputStyle: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
};

export default function FinuerProPlansClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [migrated, setMigrated] = useState(true);

  // Grant form
  const [email, setEmail] = useState("");
  const [grantPlanId, setGrantPlanId] = useState("");
  const [days, setDays] = useState(30);

  // Editor
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(BLANK);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [catalogRes, membersRes] = await Promise.all([
      fetch("/api/v1/admin/finuer-pro/plans"),
      fetch("/api/v1/admin/finuer-pro"),
    ]);
    const catalog = await catalogRes.json();
    const mem = await membersRes.json();
    if (catalog.ok || catalog.status) {
      setPlans(catalog.plans ?? []);
      setMigrated(catalog.migrated !== false);
      setGrantPlanId((prev) => {
        const purchasable = (catalog.plans as Plan[] | undefined)?.filter(
          (p) => p.unlocksPremiumBaskets && p.isActive,
        );
        if (prev && purchasable?.some((p) => p.slug === prev)) return prev;
        return purchasable?.[0]?.slug ?? "";
      });
    }
    if (mem.ok || mem.status) setMembers(mem.members ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function beginEdit(p: Plan) {
    setCreating(false);
    setEditingId(p.id);
    setDraft(toDraft(p));
    setError("");
    setMsg("");
  }

  function beginCreate() {
    setEditingId(null);
    setCreating(true);
    setDraft({ ...BLANK, sortOrder: String((plans.at(-1)?.sortOrder ?? 0) + 1) });
    setError("");
    setMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setCreating(false);
    setDraft(BLANK);
  }

  async function savePlan() {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const payload = {
        ...(editingId != null ? { id: editingId } : { slug: draft.slug.trim().toLowerCase() }),
        label: draft.label.trim(),
        tagline: draft.tagline.trim() || null,
        priceInr: Number(draft.priceInr) || 0,
        durationDays: draft.durationDays.trim() === "" ? null : Number(draft.durationDays),
        features: draft.featuresText.split("\n"),
        unlocksPremiumBaskets: draft.unlocksPremiumBaskets,
        isPurchasable: draft.isPurchasable,
        isActive: draft.isActive,
        badge: draft.badge.trim() || null,
        sortOrder: Number(draft.sortOrder) || 0,
      };
      const res = await fetch("/api/v1/admin/finuer-pro/plans", {
        method: editingId != null ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!(j.ok || j.status)) throw new Error(j.error || "Save failed");
      setMsg(
        editingId != null
          ? `Saved “${payload.label}” — the pricing cards on /user/subscriptions update immediately.`
          : `Created “${payload.label}”.`,
      );
      cancelEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Plan) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/admin/finuer-pro/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, isActive: !p.isActive }),
      });
      const j = await res.json();
      if (!(j.ok || j.status)) throw new Error(j.error || "Update failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function deletePlan(p: Plan) {
    if (!confirm(`Delete “${p.label}” permanently? Switching it off is usually safer.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/admin/finuer-pro/plans?id=${p.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!(j.ok || j.status)) throw new Error(j.error || "Delete failed");
      setMsg(`Deleted “${p.label}”.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function grant() {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/v1/admin/finuer-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant", email: email.trim(), planId: grantPlanId, days }),
      });
      const j = await res.json();
      if (!(j.ok || j.status)) throw new Error(j.error || "Grant failed");
      setMsg(`Granted ${j.planId} until ${new Date(j.expiresAt).toLocaleDateString("en-IN")}`);
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

  const editorOpen = creating || editingId != null;
  const isFreePlan = editingId != null && plans.find((p) => p.id === editingId)?.slug === "free";
  const purchasablePlans = plans.filter((p) => p.unlocksPremiumBaskets && p.isActive);
  const membersByPlan = new Map<string, number>();
  members.forEach((m) => {
    if (m.planId) membersByPlan.set(m.planId, (membersByPlan.get(m.planId) ?? 0) + 1);
  });

  return (
    <section>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Finuer Pro Plans</h1>
        <p className="page-subtitle">
          Edit pricing, duration and the feature bullets shown to users — changes go live
          immediately, no redeploy. Users can subscribe themselves from Subscriptions; grant
          manually below when you need to.
        </p>
      </div>

      {!migrated && (
        <div
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.35)",
            color: "#92400e",
            fontSize: 13,
          }}
        >
          <strong>Read-only.</strong> The <code>finuer_plans</code> table doesn&apos;t exist yet, so
          these are the built-in defaults. Run <code>npm run db:finuer-plans</code> (or{" "}
          <code>npx prisma db push</code>) to make them editable.
        </div>
      )}

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

      {/* ── Plan catalog ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15 }}>Catalog ({plans.length})</h2>
        <button
          type="button"
          onClick={beginCreate}
          disabled={!migrated || busy}
          className="theme-btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 36,
            padding: "0 14px",
            borderRadius: 8,
            border: "none",
            cursor: migrated ? "pointer" : "not-allowed",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <FiPlus size={14} /> New plan
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
          gap: 14,
          marginBottom: 28,
        }}
      >
        {plans.map((p) => {
          const live = membersByPlan.get(p.slug) ?? 0;
          return (
            <article
              key={p.id}
              style={{
                background: "var(--surface)",
                border: `1px solid ${p.isActive ? "var(--border)" : "rgba(148,163,184,0.5)"}`,
                borderRadius: 14,
                padding: 18,
                opacity: p.isActive ? 1 : 0.62,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--surface-2)", color: "var(--text-muted)", fontFamily: "ui-monospace, monospace" }}>
                  {p.slug}
                </span>
                {p.badge && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(245,158,11,0.14)", color: "#b45309" }}>
                    {p.badge}
                  </span>
                )}
                {!p.isActive && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(148,163,184,0.2)", color: "var(--text-muted)" }}>
                    Hidden
                  </span>
                )}
                {p.unlocksPremiumBaskets && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "#047857" }}>
                    Unlocks premium
                  </span>
                )}
              </div>

              <h3 style={{ margin: "0 0 2px", fontSize: 16 }}>{p.label}</h3>
              {p.tagline && (
                <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "var(--text-muted)" }}>{p.tagline}</p>
              )}
              <p style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
                ₹{p.priceInr.toLocaleString("en-IN")}
                {p.durationDays ? (
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}> / {p.durationDays}d</span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}> / forever</span>
                )}
              </p>

              <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                {p.features.length === 0 ? (
                  <li style={{ listStyle: "none", marginLeft: -18, fontStyle: "italic" }}>No features listed</li>
                ) : (
                  p.features.map((f, i) => <li key={`${f}-${i}`}>{f}</li>)
                )}
              </ul>

              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: "auto" }}>
                  {live} active member{live === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => beginEdit(p)}
                  disabled={!migrated || busy}
                  title="Edit plan"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text)" }}
                >
                  <FiEdit2 size={12} /> Edit
                </button>
                {p.slug !== "free" && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleActive(p)}
                      disabled={!migrated || busy}
                      title={p.isActive ? "Hide from users" : "Show to users"}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text)" }}
                    >
                      {p.isActive ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePlan(p)}
                      disabled={!migrated || busy}
                      title="Delete plan"
                      style={{ display: "inline-flex", alignItems: "center", padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", cursor: "pointer", color: "#b91c1c" }}
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* ── Editor ── */}
      {editorOpen && (
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(14,165,233,0.4)",
            borderRadius: 14,
            padding: 18,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>
              {creating ? "New plan" : `Editing “${draft.label}”`}
            </h2>
            <button
              type="button"
              onClick={cancelEdit}
              aria-label="Close editor"
              style={{ display: "inline-flex", padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", color: "var(--text-muted)" }}
            >
              <FiX size={14} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 12, marginBottom: 12 }}>
            {creating && (
              <label style={labelStyle}>
                Slug (permanent id)
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="pro_quarterly"
                  style={inputStyle}
                />
              </label>
            )}
            <label style={labelStyle}>
              Label
              <input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Finuer Pro · Quarterly"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Price (₹)
              <input
                type="number"
                min={0}
                step="1"
                value={draft.priceInr}
                onChange={(e) => setDraft({ ...draft, priceInr: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Duration (days) — blank = no expiry
              <input
                type="number"
                min={1}
                value={draft.durationDays}
                onChange={(e) => setDraft({ ...draft, durationDays: e.target.value })}
                placeholder="90"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Badge (optional)
              <input
                value={draft.badge}
                onChange={(e) => setDraft({ ...draft, badge: e.target.value })}
                placeholder="Best value"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Sort order
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={{ ...labelStyle, marginBottom: 12 }}>
            Tagline (one line under the title)
            <input
              value={draft.tagline}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              placeholder="Full access, billed quarterly"
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: 12 }}>
            Features — one bullet per line (max 20)
            <textarea
              value={draft.featuresText}
              onChange={(e) => setDraft({ ...draft, featuresText: e.target.value })}
              rows={6}
              placeholder={"Everything in Free\nPremium Finuer Baskets\nPro-only competitions"}
              style={{ ...inputStyle, height: "auto", padding: 10, lineHeight: 1.6, resize: "vertical", fontFamily: "inherit" }}
            />
          </label>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
            {(
              [
                ["unlocksPremiumBaskets", "Unlocks premium baskets & Pro competitions"],
                ["isPurchasable", "Users can buy this plan"],
                ["isActive", "Visible to users"],
              ] as const
            ).map(([key, text]) => (
              <label
                key={key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12.5,
                  color: isFreePlan ? "var(--text-muted)" : "var(--text)",
                  cursor: isFreePlan ? "not-allowed" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={draft[key]}
                  disabled={isFreePlan}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
                />
                {text}
              </label>
            ))}
          </div>

          {isFreePlan && (
            <p style={{ margin: "0 0 14px", fontSize: 11.5, color: "var(--text-muted)" }}>
              The Free baseline is what every non-Pro user falls back to, so its three switches are
              locked. Its label, price and feature bullets are editable.
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={savePlan}
              disabled={busy || !draft.label.trim() || (creating && !draft.slug.trim())}
              className="theme-btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              <FiCheck size={14} /> {busy ? "Saving…" : creating ? "Create plan" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={busy}
              style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text)" }}
            >
              Cancel
            </button>
          </div>
        </article>
      )}

      {/* ── Manual grant ── */}
      <article style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>Grant Finuer Pro manually</h2>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
          For comps, support cases and testing. Users can subscribe themselves from
          Subscriptions &amp; Purchases.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <label style={{ ...labelStyle, minWidth: 220 }}>
            User email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              style={{ ...inputStyle, height: 38 }}
            />
          </label>
          <label style={{ ...labelStyle, minWidth: 190 }}>
            Plan
            <select
              value={grantPlanId}
              onChange={(e) => {
                setGrantPlanId(e.target.value);
                const p = plans.find((x) => x.slug === e.target.value);
                if (p?.durationDays) setDays(p.durationDays);
              }}
              style={{ ...inputStyle, height: 38 }}
            >
              {purchasablePlans.length === 0 && <option value="">No Pro plans available</option>}
              {purchasablePlans.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...labelStyle, width: 100 }}>
            Days
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 30)}
              style={{ ...inputStyle, height: 38 }}
            />
          </label>
          <button
            type="button"
            disabled={busy || !email.trim() || !grantPlanId}
            onClick={grant}
            className="theme-btn-primary"
            style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            {busy ? "Saving…" : "Grant Pro"}
          </button>
        </div>
      </article>

      {/* ── Active members ── */}
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
                          color: "var(--text)",
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
