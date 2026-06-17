"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Mounted on user-facing pages for a *pending* advisor who is browsing the
 * community while they wait. Polls the advisor status endpoint and, the moment
 * the admin approves the application, shows a brief confirmation toast and then
 * sends them straight into their console — no manual refresh or re-login (their
 * token already carries role: advisor; only the DB verificationStatus gates the
 * dashboard).
 */

// How often we ask the server "is it approved yet?" (see also the focus
// re-check below, which fires immediately when the tab regains focus).
const POLL_MS = 15000;
// How long the "Approved!" toast stays up before we redirect.
const REDIRECT_DELAY_MS = 900;

export default function AdvisorApprovalWatcher() {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      if (redirectedRef.current) return;
      try {
        const res = await fetch("/api/v1/advisor/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const status = data?.verification_status ?? data?.profile?.verificationStatus;
        if (!cancelled && status === "approved") {
          redirectedRef.current = true;
          setApproved(true);
          redirectTimer = setTimeout(() => {
            router.replace("/advisor/dashboard");
            router.refresh();
          }, REDIRECT_DELAY_MS);
        }
      } catch {
        // Transient network error — just try again on the next tick.
      }
    };

    const id = setInterval(check, POLL_MS);
    // Re-check immediately whenever the tab regains focus, so approval is picked
    // up fast when the user comes back to the page.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(redirectTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  if (!approved) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 20px",
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid #d1fae5",
        boxShadow: "0 12px 40px rgba(15, 23, 42, 0.14)",
        animation: "advisor-approve-in 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "#22c55e",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 15,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        ✓
      </span>
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Application approved!</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Taking you to your dashboard…</div>
      </div>
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          marginLeft: 4,
          borderRadius: 999,
          border: "2px solid var(--border)",
          borderTopColor: "#22c55e",
          animation: "advisor-approve-spin 0.7s linear infinite",
          flexShrink: 0,
        }}
      />
      <style>{`
        @keyframes advisor-approve-in {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes advisor-approve-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
