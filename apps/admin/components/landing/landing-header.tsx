"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import FinuerLogo from "@/components/brand/finuer-logo";
import { FiGlobe, FiChevronDown, FiMoon, FiSun, FiArrowUpRight } from "react-icons/fi";
import { useTheme } from "@/components/theme/theme-provider";

/** Language pill (visual). */
function LangPill() {
  return (
    <button type="button" className="lp-lang" aria-label="Language: English">
      <FiGlobe size={15} />
      <span>English</span>
      <FiChevronDown size={13} className="lp-lang-caret" aria-hidden />
    </button>
  );
}

/** Segmented moon / sun theme toggle — wired to the real theme provider. */
function ThemeSegToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className="lp-theme-seg" role="group" aria-label="Theme">
      <button
        type="button"
        className={`lp-theme-opt${isDark ? " active" : ""}`}
        aria-pressed={isDark}
        aria-label="Dark mode"
        onClick={() => { if (!isDark) toggleTheme(); }}
      >
        <FiMoon size={15} />
      </button>
      <button
        type="button"
        className={`lp-theme-opt${!isDark ? " active" : ""}`}
        aria-pressed={!isDark}
        aria-label="Light mode"
        onClick={() => { if (isDark) toggleTheme(); }}
      >
        <FiSun size={15} />
      </button>
    </div>
  );
}

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

type NavLinksProps = {
  onNavigate?: () => void;
  /** Section id currently in view, used to highlight the matching link. */
  activeId?: string | null;
  /** Staggers drawer items in; desktop passes false. */
  stagger?: boolean;
};

function NavLinks({ onNavigate, activeId, stagger = false }: NavLinksProps) {
  return (
    <>
      <nav className="lp-nav" aria-label="Main">
        {NAV.map((item, i) => {
          const active = activeId != null && item.href === `#${activeId}`;
          return (
            <a
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "true" : undefined}
              className={active ? "is-active" : undefined}
              style={stagger ? ({ "--i": i } as CSSProperties) : undefined}
            >
              {item.label}
              {item.dropdown && <span className="lp-nav-chevron" aria-hidden>▾</span>}
            </a>
          );
        })}
      </nav>

      <div
        className="lp-header-actions"
        style={stagger ? ({ "--i": NAV.length } as CSSProperties) : undefined}
      >
        <Link href="/login" className="lp-btn-login" onClick={onNavigate}>
          Log in
        </Link>
        <LangPill />
        <ThemeSegToggle />
        <Link href="/register" className="lp-btn-start" onClick={onNavigate}>
          Start Now
          <span className="lp-start-arrow" aria-hidden>
            <FiArrowUpRight size={15} />
          </span>
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
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // Condense the bar into its glass state once the page leaves the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight whichever section is currently under the header.
  useEffect(() => {
    const ids = NAV.map(n => n.href.slice(1));
    const sections = ids
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (!sections.length || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.25, 0.5] },
    );

    sections.forEach(s => observer.observe(s));
    return () => observer.disconnect();
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
              <NavLinks onNavigate={close} activeId={activeId} stagger />
            </div>
          </aside>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <header
        className={`lp-header${open ? " nav-open" : ""}${scrolled ? " lp-header--scrolled" : ""}`}
      >
        <div className="landing-container lp-header-inner">
          <FinuerLogo href="/" height={40} className="lp-brand-logo" onClick={close} />

          <div className="lp-nav-drawer lp-nav-drawer--desktop">
            <NavLinks activeId={activeId} />
          </div>

          <button
            type="button"
            className={`lp-menu-toggle${open ? " is-open" : ""}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={toggleMenu}
          >
            <span className="lp-menu-bars" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>
      {mobileDrawer}
    </>
  );
}
