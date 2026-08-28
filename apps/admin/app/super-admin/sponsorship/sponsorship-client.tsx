"use client";

import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiX, FiCheck, FiStar } from "react-icons/fi";
import { LoadingRows } from "@/components/loading-shimmer";

type Tier = {
  id: string;
  label: string;
  tagline: string | null;
  priceInr: number;
  durationDays: number;
  isPurchasable: boolean;
  isActive: boolean;
  badge: string | null;
  sortOrder: number;
};

type FeaturedAdvisor = {
  userId: number;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
  featuredUntil: string | null;
  tierId: string | null;
  tierLabel: string | null;
  daysLeft: number;
  active: boolean;
};

type Revenue = {
  total: number;
  last30d: number;
  purchases: number;
  comped: number;
};

type Draft = {
  slug: string;
  label: string;
  tagline: string;
  priceInr: string;
  durationDays: string;
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
  isPurchasable: true,
  isActive: true,
  badge: "",
  sortOrder: "10",
};

function toDraft(t: Tier): Draft {
  return {
    slug: t.id,
    label: t.label,
    tagline: t.tagline ?? "",
    priceInr: String(t.priceInr),
    durationDays: String(t.durationDays),
    isPurchasable: t.isPurchasable,
    isActive: t.isActive,
    badge: t.badge ?? "",
    sortOrder: String(t.sortOrder),
  };
}

function inr(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const input: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 11px",
  borderRadius: 9,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 5,
};

/**
 * Sponsorship console.
 *
 * Two halves: who is currently a Featured Analyst (and what that has earned),
 * and the tier catalog that drives the purchase cards on /advisor/services.
 * Before this existed advisors self-served a free placement with no oversight
 * at all — nobody could see who was promoted, or take it away.
 */
export default function SponsorshipClient() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [advisors, setAdvisors] = useState<FeaturedAdvisor[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  // Grant form
  const [grantUserId, setGrantUserId] = useState("");
  const [grantTier, setGrantTier] = useState("");
  const [grantDays, setGrantDays] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [tRes, aRes] = await Promise.all([
        fetch("/api/v1/admin/sponsorship/tiers"),
        fetch("/api/v1/admin/sponsorship/advisors"),
      ]);
      const tJson = await tRes.json();
      const aJson = await aRes.json();
      if (!tRes.ok) throw new Error(tJson?.error ?? "Could not load tiers");
      if (!aRes.ok) throw new Error(aJson?.error ?? "Could not load placements");

      const nextTiers: Tier[] = (tJson.data ?? tJson).tiers ?? [];
      setTiers(nextTiers);
      setAdvisors((aJson.data ?? aJson).advisors ?? []);
      setRevenue((aJson.data ?? aJson).revenue ?? null);
      if (!grantTier && nextTiers.length) setGrantTier(nextTiers[0].id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [grantTier]);

  useEffect(() => {
    void load();
    // load is stable enough here; re-running on grantTier would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(msg: string) {
    setNote(msg);
    setTimeout(() => setNote(null), 3200);
  }

  async function saveTier() {
    setBusy(true);
    setErr(null);
    try {
      const method = creating ? "POST" : "PUT";
      const r = await fetch("/api/v1/admin/sponsorship/tiers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: draft.slug,
          label: draft.label,
          tagline: draft.tagline || null,
          priceInr: draft.priceInr,
          durationDays: draft.durationDays,
          isPurchasable: draft.isPurchasable,
          isActive: draft.isActive,
          badge: draft.badge || null,
          sortOrder: draft.sortOrder,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "Could not save");
      setEditing(null);
      setCreating(false);
      flash(creating ? "Tier created" : "Tier saved");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTier(slug: string) {
    if (!confirm(`Delete the "${slug}" tier? Deactivating is usually safer.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/v1/admin/sponsorship/tiers?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "Could not delete");
      flash("Tier deleted");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  async function grant() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/v1/admin/sponsorship/advisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: grantUserId,
          tier: grantTier,
          days: grantDays || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "Could not grant");
      setGrantUserId("");
      setGrantDays("");
      flash("Placement granted");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not grant");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: number, name: string) {
    if (!confirm(`Remove ${name}'s featured placement?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/v1/admin/sponsorship/advisors?userId=${userId}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error ?? "Could not revoke");
      flash("Placement removed");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not revoke");
    } finally {
      setBusy(false);
    }
  }

  const activeCount = advisors.filter((a) => a.active).length;

  return (
    <section className="advisor-scope">
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "var(--text)" }}>
            Sponsorship
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Featured Analyst placements and the tier catalogue behind them
          </p>
        </div>
      </div>

      {err && (
        <div
          role="alert"
          style={{
            marginBottom: 14,
            padding: "10px 13px",
            borderRadius: 10,
            border: "1px solid rgba(220,38,38,0.35)",
            background: "rgba(220,38,38,0.08)",
            color: "var(--danger, #dc2626)",
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}
      {note && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 13px",
            borderRadius: 10,
            border: "1px solid rgba(16,185,129,0.35)",
            background: "rgba(16,185,129,0.08)",
            color: "var(--primary-text, #047857)",
            fontSize: 13,
          }}
        >
          {note}
        </div>
      )}

      {/* ── Revenue ─────────────────────────────────────────────────────── */}
      <div className="stat-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: "Active placements", value: String(activeCount) },
          { label: "Sponsorship revenue", value: inr(revenue?.total ?? 0) },
          { label: "Last 30 days", value: inr(revenue?.last30d ?? 0) },
          {
            label: "Purchases / comped",
            value: `${revenue?.purchases ?? 0} / ${revenue?.comped ?? 0}`,
          },
        ].map((s) => (
          <article className="stat-card" key={s.label}>
            <p className="stat-card-label">{s.label}</p>
            <p style={{ margin: 0, fontSize: 21, fontWeight: 700, color: "var(--text)" }}>
              {s.value}
            </p>
          </article>
        ))}
      </div>

      <p
        style={{
          margin: "0 0 20px",
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.6,
        }}
      >
        Placements are applied immediately and recorded in <code>payments</code> as{" "}
        <code>featured_placement</code>. No card is charged yet — purchases are written with
        provider <code>dev_bypass</code>, admin grants with <code>admin_grant</code> at ₹0, so
        comping a placement never inflates revenue.
      </p>

      {/* ── Grant ───────────────────────────────────────────────────────── */}
      <article className="card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>Grant a placement</h3>
        <div className="stat-grid-4" style={{ alignItems: "end" }}>
          <div>
            <label style={labelStyle} htmlFor="sp-user">
              Advisor user ID
            </label>
            <input
              id="sp-user"
              style={input}
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              placeholder="e.g. 3"
              inputMode="numeric"
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="sp-tier">
              Tier
            </label>
            <select
              id="sp-tier"
              style={input}
              value={grantTier}
              onChange={(e) => setGrantTier(e.target.value)}
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} · {inr(t.priceInr)} · {t.durationDays}d
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="sp-days">
              Days (optional override)
            </label>
            <input
              id="sp-days"
              style={input}
              value={grantDays}
              onChange={(e) => setGrantDays(e.target.value)}
              placeholder="tier default"
              inputMode="numeric"
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={grant}
            disabled={busy || !grantUserId || !grantTier}
            style={{ height: 38, fontSize: 13, fontWeight: 700 }}
          >
            {busy ? "Working…" : "Grant"}
          </button>
        </div>
      </article>

      {/* ── Current placements ──────────────────────────────────────────── */}
      <article className="card" style={{ padding: 18, marginBottom: 22 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>
          Featured analysts{" "}
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>
            ({advisors.length})
          </span>
        </h3>

        {loading ? (
          <LoadingRows />
        ) : advisors.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            No advisor has ever held a placement.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
                  <th style={{ padding: "8px 10px", fontWeight: 600 }}>Advisor</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600 }}>Tier</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600 }}>Until</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600 }} />
                </tr>
              </thead>
              <tbody>
                {advisors.map((a) => (
                  <tr key={a.userId} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>{a.fullName}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        #{a.userId} · {a.email}
                      </div>
                    </td>
                    <td style={{ padding: "10px", color: "var(--text-muted)" }}>
                      {a.tierLabel ?? "—"}
                    </td>
                    <td style={{ padding: "10px", color: "var(--text-muted)" }}>
                      {fmtDate(a.featuredUntil)}
                    </td>
                    <td style={{ padding: "10px" }}>
                      {a.active ? (
                        <span
                          style={{
                            padding: "2px 9px",
                            borderRadius: 999,
                            fontSize: 10.5,
                            fontWeight: 800,
                            textTransform: "uppercase",
                            background: "rgba(245,158,11,0.16)",
                            color: "#b45309",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <FiStar size={9} style={{ verticalAlign: -1 }} /> {a.daysLeft}d left
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Lapsed</span>
                      )}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right" }}>
                      {a.active && (
                        <button
                          type="button"
                          onClick={() => revoke(a.userId, a.fullName)}
                          disabled={busy}
                          style={{
                            padding: "6px 11px",
                            fontSize: 12,
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--danger, #dc2626)",
                            cursor: busy ? "wait" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {/* ── Tier catalogue ──────────────────────────────────────────────── */}
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Tier catalogue</h3>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setCreating(true);
            setEditing("__new__");
            setDraft(BLANK);
          }}
          disabled={busy}
          style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700 }}
        >
          <FiPlus size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
          New tier
        </button>
      </div>

      <div className="stat-grid-3" style={{ marginBottom: 18 }}>
        {tiers.map((t) => {
          const isEditing = editing === t.id;
          return (
            <article
              key={t.id}
              className="card"
              style={{ padding: 16, opacity: t.isActive ? 1 : 0.55 }}
            >
              {isEditing ? (
                <TierForm
                  draft={draft}
                  setDraft={setDraft}
                  slugLocked
                  busy={busy}
                  onSave={saveTier}
                  onCancel={() => {
                    setEditing(null);
                    setCreating(false);
                  }}
                />
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                        {t.label}
                      </div>
                      <code style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.id}</code>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        aria-label={`Edit ${t.label}`}
                        onClick={() => {
                          setCreating(false);
                          setEditing(t.id);
                          setDraft(toDraft(t));
                        }}
                        disabled={busy}
                        style={iconBtn}
                      >
                        <FiEdit2 size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${t.label}`}
                        onClick={() => deleteTier(t.id)}
                        disabled={busy}
                        style={{ ...iconBtn, color: "var(--danger, #dc2626)" }}
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}
                  >
                    {inr(t.priceInr)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                    {t.durationDays} days
                    {t.tagline ? ` · ${t.tagline}` : ""}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {t.badge && <Pill tone="amber">{t.badge}</Pill>}
                    <Pill tone={t.isActive ? "green" : "grey"}>
                      {t.isActive ? "Active" : "Inactive"}
                    </Pill>
                    <Pill tone={t.isPurchasable ? "green" : "grey"}>
                      {t.isPurchasable ? "Purchasable" : "Admin only"}
                    </Pill>
                  </div>
                </>
              )}
            </article>
          );
        })}

        {creating && editing === "__new__" && (
          <article className="card" style={{ padding: 16 }}>
            <TierForm
              draft={draft}
              setDraft={setDraft}
              slugLocked={false}
              busy={busy}
              onSave={saveTier}
              onCancel={() => {
                setEditing(null);
                setCreating(false);
              }}
            />
          </article>
        )}
      </div>
    </section>
  );
}

const iconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text-muted)",
  cursor: "pointer",
};

function Pill({ tone, children }: { tone: "green" | "amber" | "grey"; children: React.ReactNode }) {
  const tones = {
    green: { bg: "rgba(16,185,129,0.14)", fg: "var(--primary-text, #047857)" },
    amber: { bg: "rgba(245,158,11,0.16)", fg: "#b45309" },
    grey: { bg: "var(--surface-2)", fg: "var(--text-muted)" },
  }[tone];
  return (
    <span
      style={{
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        background: tones.bg,
        color: tones.fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function TierForm({
  draft,
  setDraft,
  slugLocked,
  busy,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  slugLocked: boolean;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div>
        <label style={labelStyle}>Slug</label>
        <input
          style={{ ...input, opacity: slugLocked ? 0.6 : 1 }}
          value={draft.slug}
          disabled={slugLocked}
          onChange={(e) => set("slug", e.target.value)}
          placeholder="monthly"
        />
        {slugLocked && (
          <p style={{ margin: "4px 0 0", fontSize: 10.5, color: "var(--text-muted)" }}>
            Slug is the stored identity of existing placements — it can&apos;t change.
          </p>
        )}
      </div>
      <div>
        <label style={labelStyle}>Label</label>
        <input style={input} value={draft.label} onChange={(e) => set("label", e.target.value)} />
      </div>
      <div>
        <label style={labelStyle}>Tagline</label>
        <input
          style={input}
          value={draft.tagline}
          onChange={(e) => set("tagline", e.target.value)}
        />
      </div>
      <div className="split-2">
        <div>
          <label style={labelStyle}>Price (₹)</label>
          <input
            style={input}
            value={draft.priceInr}
            inputMode="decimal"
            onChange={(e) => set("priceInr", e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Duration (days)</label>
          <input
            style={input}
            value={draft.durationDays}
            inputMode="numeric"
            onChange={(e) => set("durationDays", e.target.value)}
          />
        </div>
      </div>
      <div className="split-2">
        <div>
          <label style={labelStyle}>Badge</label>
          <input style={input} value={draft.badge} onChange={(e) => set("badge", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Sort order</label>
          <input
            style={input}
            value={draft.sortOrder}
            inputMode="numeric"
            onChange={(e) => set("sortOrder", e.target.value)}
          />
        </div>
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
        />
        Active
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input
          type="checkbox"
          checked={draft.isPurchasable}
          onChange={(e) => set("isPurchasable", e.target.checked)}
        />
        Advisors can buy it
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={onSave}
          disabled={busy}
          style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700 }}
        >
          <FiCheck size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: "8px 12px",
            fontSize: 13,
            borderRadius: 9,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <FiX size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Cancel
        </button>
      </div>
    </div>
  );
}
