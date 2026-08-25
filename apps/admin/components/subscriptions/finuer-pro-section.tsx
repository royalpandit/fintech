"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheck, FiZap, FiAlertCircle } from "react-icons/fi";

export type FinuerProPlanCard = {
  id: string;
  label: string;
  tagline: string | null;
  priceInr: number;
  durationDays: number | null;
  features: string[];
  badge: string | null;
};

export type FinuerProStatusView = {
  active: boolean;
  planId: string;
  planLabel: string;
  expiresAt: string | null;
  viaRole: boolean;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** ₹499 / month reads better than ₹499 / 30d on a pricing card. */
function perLabel(days: number | null) {
  if (days == null) return "forever";
  if (days === 30 || days === 31) return "month";
  if (days === 90 || days === 91 || days === 92) return "quarter";
  if (days === 365 || days === 366) return "year";
  if (days === 7) return "week";
  return `${days} days`;
}

/**
 * Finuer Pro — the platform plan. Lives inline at the top of
 * /user/subscriptions rather than behind its own tab, because it's the one
 * subscription that isn't tied to an advisor and shouldn't need hunting for.
 * The `finuer-pro` id is the anchor target for the premium-basket lock CTAs.
 */
export default function FinuerProSection({
  plans,
  status,
}: {
  plans: FinuerProPlanCard[];
  status: FinuerProStatusView;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState(!status.active);

  // The basket lock overlays link here with ?tab=finuer-pro (legacy) or
  // #finuer-pro. Scroll the block into view either way.
  useEffect(() => {
    const url = new URL(window.location.href);
    const wanted =
      url.hash === "#finuer-pro" || url.searchParams.get("tab") === "finuer-pro";
    if (!wanted) return;
    setExpanded(true);
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function subscribe(planId: string) {
    setBusy(planId);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/v1/finuer-pro/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const j = await res.json();
      if (!(j.ok || j.status)) throw new Error(j.error || "Could not activate the plan");
      setMsg(
        `${j.planLabel} ${j.renewal ? "renewed" : "activated"} — active until ${fmtDate(j.expiresAt)}.`,
      );
      setExpanded(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not activate the plan");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!confirm("Cancel Finuer Pro now? Premium baskets lock immediately.")) return;
    setBusy("cancel");
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/v1/finuer-pro/subscribe", { method: "DELETE" });
      const j = await res.json();
      if (!(j.ok || j.status)) throw new Error(j.error || "Could not cancel");
      setMsg("Finuer Pro cancelled.");
      setExpanded(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(null);
    }
  }

  const left = status.expiresAt ? daysLeft(status.expiresAt) : null;
  const expiringSoon = left != null && left <= 7;

  return (
    <section ref={rootRef} id="finuer-pro" className="fpro">
      <div className="fpro-head">
        <div className="fpro-head-text">
          <div className="fpro-title-row">
            <FiZap size={16} className="fpro-bolt" />
            <h2>Finuer Pro</h2>
            <span className={`fpro-state${status.active ? " on" : ""}`}>
              {status.active ? "Active" : "Free plan"}
            </span>
          </div>
          <p>
            {status.viaRole
              ? "Your staff account includes Finuer Pro — premium baskets and Pro-only competitions are always unlocked."
              : status.active
                ? `${status.planLabel}${
                    status.expiresAt
                      ? ` · renews ${fmtDate(status.expiresAt)} · ${left} day${left === 1 ? "" : "s"} left`
                      : ""
                  }`
                : "Platform plan — unlocks premium Finuer Baskets (full holdings & returns) and Pro-only competitions."}
          </p>
        </div>

        {!status.viaRole && (
          <div className="fpro-head-actions">
            {status.active ? (
              <>
                <button
                  type="button"
                  className="fpro-btn-ghost"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? "Hide plans" : "Change plan"}
                </button>
                <button
                  type="button"
                  className="fpro-btn-ghost fpro-btn-danger"
                  onClick={cancel}
                  disabled={busy === "cancel"}
                >
                  {busy === "cancel" ? "Cancelling…" : "Cancel"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="fpro-btn"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Hide plans" : "See Pro plans"}
              </button>
            )}
          </div>
        )}
      </div>

      {expiringSoon && status.active && !status.viaRole && (
        <p className="fpro-note fpro-note-warn">
          <FiAlertCircle size={13} /> Expires in {left} day{left === 1 ? "" : "s"} — renewing extends
          from your current end date, so no paid days are lost.
        </p>
      )}
      {error && <p className="fpro-note fpro-note-err">{error}</p>}
      {msg && <p className="fpro-note fpro-note-ok">{msg}</p>}

      {expanded && !status.viaRole && (
        <>
          {plans.length === 0 ? (
            <p className="fpro-note">No Pro plans are on sale right now.</p>
          ) : (
            <div className="fpro-grid">
              {plans.map((p) => {
                const isCurrent = status.active && status.planId === p.id;
                return (
                  <article key={p.id} className={`fpro-card${isCurrent ? " current" : ""}`}>
                    {p.badge && <span className="fpro-card-badge">{p.badge}</span>}
                    <h3>{p.label}</h3>
                    {p.tagline && <p className="fpro-card-tagline">{p.tagline}</p>}
                    <p className="fpro-card-price">
                      ₹{p.priceInr.toLocaleString("en-IN")}
                      <span> / {perLabel(p.durationDays)}</span>
                    </p>
                    <ul className="fpro-card-features">
                      {p.features.map((f, i) => (
                        <li key={`${f}-${i}`}>
                          <FiCheck size={13} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={`fpro-btn fpro-card-cta${isCurrent ? " fpro-btn-ghost" : ""}`}
                      onClick={() => subscribe(p.id)}
                      disabled={busy != null}
                    >
                      {busy === p.id
                        ? "Activating…"
                        : isCurrent
                          ? "Renew"
                          : status.active
                            ? "Switch to this plan"
                            : "Subscribe"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
