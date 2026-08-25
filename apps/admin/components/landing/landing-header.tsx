"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import FinuerLogo from "@/components/brand/finuer-logo";
import { FiArrowUpRight } from "react-icons/fi";
import PanelThemeToggle from "@/components/theme/panel-theme-toggle";

/**
 * Single theme toggle — shows the icon for the mode you'll switch to.
 * Delegates to the shared PanelThemeToggle, which keeps both icons in the DOM
 * and lets CSS pick one off the data-theme attribute. Choosing the icon from
 * React state (as this did) renders the dark one on the server and swaps it
 * after hydration, which a light-mode visitor sees as a flicker on every load.
 */
function ThemeToggle() {
  return <PanelThemeToggle className="lp-theme-toggle" size={16} />;
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

type CtaHandler = (e: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;

type NavLinksProps = {
  onNavigate?: () => void;
  /** Section id currently in view, used to highlight the matching link. */
  activeId?: string | null;
  /** Staggers drawer items in; desktop passes false. */
  stagger?: boolean;
  /** Fires the branded route-transition curtain for Log in / Start Now. */
  onCta?: CtaHandler;
};

function NavLinks({ onNavigate, activeId, stagger = false, onCta }: NavLinksProps) {
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
        <Link
          href="/login"
          className="lp-btn-login"
          onClick={onCta ? e => onCta(e, "/login") : onNavigate}
        >
          Log in
        </Link>
        <ThemeToggle />
        <Link
          href="/register"
          className="lp-btn-start"
          onClick={onCta ? e => onCta(e, "/register") : onNavigate}
        >
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

/** Milliseconds the curtain plays before the route actually changes. */
const CTA_TRANSITION_MS = 780;

export default function LandingHeader() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cta, setCta] = useState<{ href: string; x: number; y: number } | null>(null);
  const ctaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => setOpen(false), []);

  /**
   * Intercepts Log in / Start Now clicks to play a branded circular-reveal
   * curtain that grows from the click point, then routes. Falls back to a
   * plain navigation for modified clicks or reduced-motion users.
   */
  const startCta = useCallback<CtaHandler>(
    (e, href) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      close();

      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return; // let <Link> navigate immediately

      e.preventDefault();
      router.prefetch?.(href);
      setCta({ href, x: e.clientX, y: e.clientY });
      ctaTimer.current = setTimeout(() => router.push(href), CTA_TRANSITION_MS);
    },
    [close, router],
  );

  useEffect(() => () => {
    if (ctaTimer.current) clearTimeout(ctaTimer.current);
  }, []);

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

  const ctaCurtain =
    mounted && cta
      ? createPortal(
          <div
            className="lp-route-curtain"
            style={{ "--rt-x": `${cta.x}px`, "--rt-y": `${cta.y}px` } as CSSProperties}
            role="status"
            aria-live="polite"
          >
            <div className="lp-route-curtain-inner">
              <span className="lp-route-mark">Finuer</span>
              <span className="lp-route-label">
                {cta.href === "/login" ? "Signing you in…" : "Let's get you started…"}
              </span>
            </div>
          </div>,
          document.body,
        )
      : null;

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
              <NavLinks onNavigate={close} activeId={activeId} stagger onCta={startCta} />
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
          <FinuerLogo href="/" height={52} className="lp-brand-logo" onClick={close} />

          <div className="lp-nav-drawer lp-nav-drawer--desktop">
            <NavLinks activeId={activeId} onCta={startCta} />
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
      {ctaCurtain}
    </>
  );
}
