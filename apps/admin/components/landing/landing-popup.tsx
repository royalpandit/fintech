"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DISMISS_KEY = "finuer_lp_promo_dismissed";
/** Re-offer after this long rather than never showing again. */
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OPEN_DELAY_MS = 9000;

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export default function LandingPopup() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const firedRef = useRef(false);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage blocked — it will simply offer again next visit */
    }
  }, []);

  useEffect(() => setMounted(true), []);

  // Open on a timer, or sooner if the pointer leaves through the top of the
  // window (classic exit intent). Whichever happens first wins.
  useEffect(() => {
    if (wasRecentlyDismissed()) return;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      setOpen(true);
    };

    const timer = window.setTimeout(fire, OPEN_DELAY_MS);
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) fire();
    };
    document.addEventListener("mouseout", onLeave);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseout", onLeave);
    };
  }, []);

  // Lock scroll, trap focus, restore focus on close.
  useEffect(() => {
    if (!open) return;

    lastFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = window.setTimeout(() => {
      const node = cardRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      node?.focus();
    }, 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
        return;
      }
      if (e.key !== "Tab") return;

      const nodes = cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus?.();
    };
  }, [open, dismiss]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="lp-modal-layer">
      <button
        type="button"
        className="lp-modal-backdrop"
        aria-label="Close dialog"
        onClick={dismiss}
      />
      <div
        className="lp-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-modal-title"
        aria-describedby="lp-modal-desc"
        ref={cardRef}
      >
        <button
          type="button"
          className="lp-modal-close"
          aria-label="Close"
          onClick={dismiss}
        >
          ✕
        </button>

        <div className="lp-modal-badge" aria-hidden>
          <span className="lp-pill-dot" />
          Limited time
        </div>

        <h2 id="lp-modal-title">
          Start investing <span className="lp-gradient-text">free</span>
        </h2>
        <p id="lp-modal-desc">
          Join 10L+ investors learning, trading and following SEBI registered advisors on Finuer.
          No card required.
        </p>

        <ul className="lp-modal-list">
          {[
            "₹10,00,000 virtual cash to practice with",
            "Follow verified SEBI advisors",
            "Live markets, charts and option chains",
          ].map(t => (
            <li key={t}>
              <span className="lp-check" aria-hidden>✓</span>
              {t}
            </li>
          ))}
        </ul>

        <div className="lp-modal-actions">
          <Link href="/register" className="lp-btn-primary" onClick={dismiss}>
            Create free account <span aria-hidden>→</span>
          </Link>
          <button type="button" className="lp-modal-dismiss" onClick={dismiss}>
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
