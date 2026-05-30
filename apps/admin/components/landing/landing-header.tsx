"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FinuerLogo from "@/components/brand/finuer-logo";
import ThemeHeaderButton from "@/components/theme/theme-header-button";

const NAV = [
  { label: "Products", href: "#products" },
  { label: "Markets", href: "#markets" },
  { label: "Advisors", href: "#advisors" },
  { label: "Virtual Lab", href: "#virtual-lab" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources", dropdown: true },
  { label: "Company", href: "#company", dropdown: true },
];

const MOBILE_MQ = "(max-width: 768px)";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <nav className="lp-nav" aria-label="Main">
        {NAV.map(item => (
          <a key={item.label} href={item.href} onClick={onNavigate}>
            {item.label}
            {item.dropdown && <span className="lp-nav-chevron">▾</span>}
          </a>
        ))}
      </nav>

      <div className="lp-header-actions">
        <ThemeHeaderButton />
        <Link href="/login" className="lp-btn-login" onClick={onNavigate}>
          Log in
        </Link>
        <Link href="/register" className="lp-btn-primary" onClick={onNavigate}>
          Get Started Free <span aria-hidden>→</span>
        </Link>
      </div>
    </>
  );
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_MQ).matches;
}

export default function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const toggleMenu = () => {
    if (!isMobileViewport()) return;
    setOpen(v => !v);
  };

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => {
      if (!mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.querySelector(".landing-root");
    const mobile = isMobileViewport();

    if (open && mobile) {
      root?.classList.add("lp-menu-open");
    } else {
      root?.classList.remove("lp-menu-open");
    }

    if (!open || !mobile) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root?.classList.remove("lp-menu-open");
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const showMobileDrawer = mounted && open && isMobileViewport();

  const mobileDrawer = showMobileDrawer
    ? createPortal(
        <>
          <button
            type="button"
            className="lp-nav-backdrop lp-nav-backdrop--open"
            aria-label="Close menu"
            onClick={close}
          />
          <aside
            className="lp-nav-drawer lp-nav-drawer--mobile"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="lp-nav-drawer-top">
              <span className="lp-nav-drawer-title">Menu</span>
              <button
                type="button"
                className="lp-nav-drawer-close"
                aria-label="Close menu"
                onClick={close}
              >
                ✕
              </button>
            </div>
            <div className="lp-nav-drawer-body">
              <NavLinks onNavigate={close} />
            </div>
          </aside>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <header className={`lp-header${open ? " nav-open" : ""}`}>
        <div className="landing-container lp-header-inner">
          <FinuerLogo href="/" height={40} className="lp-brand-logo" onClick={close} />

          <div className="lp-nav-drawer lp-nav-drawer--desktop">
            <NavLinks />
          </div>

          <button
            type="button"
            className="lp-menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={toggleMenu}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </header>
      {mobileDrawer}
    </>
  );
}
