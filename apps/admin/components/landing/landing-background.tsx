"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Scroll-driven ambient background.
 *
 * Everything is composited from four fixed layers behind the page content.
 * Scroll position is written once per frame into two CSS custom properties
 * (--sp = 0..1 page progress, --sps = 0..1 progress within the active stage)
 * and all motion is expressed in CSS from there — no per-frame React renders,
 * and only transform/opacity are animated so it stays on the compositor.
 */

/** Ordered scroll stages. Each swaps the palette and re-positions the blobs. */
const STAGES = [
  "hero",
  "products",
  "tour",
  "lab",
  "advisors",
  "community",
  "cta",
] as const;

const STAGE_SELECTORS: Record<(typeof STAGES)[number], string> = {
  hero: ".lp-hero",
  products: "#products",
  tour: "#product-tour",
  lab: "#virtual-lab",
  advisors: "#advisors",
  community: "#community",
  cta: "#pricing",
};

const PARTICLES = Array.from({ length: 18 }, (_, i) => i);

export default function LandingBackground() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<string>("hero");

  // Page scroll progress -> CSS variables, throttled to one write per frame.
  // Written on <html> rather than the layer root so anything on the page can
  // read them — the background sits in a z-index:-1 stacking context and would
  // otherwise trap the progress bar behind the content.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const doc = document.documentElement;

    const update = () => {
      frame = 0;
      const max = doc.scrollHeight - window.innerHeight;
      const sp = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      doc.style.setProperty("--sp", sp.toFixed(4));
      // Sawtooth within each stage, for effects that should restart per section.
      doc.style.setProperty("--sps", ((sp * STAGES.length) % 1).toFixed(4));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Which section owns the viewport right now -> palette stage.
  useEffect(() => {
    const entries = STAGES.map(name => {
      const el = document.querySelector<HTMLElement>(STAGE_SELECTORS[name]);
      return el ? { name, el } : null;
    }).filter((x): x is { name: (typeof STAGES)[number]; el: HTMLElement } => x != null);

    if (!entries.length || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      obs => {
        const best = obs
          .filter(o => o.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best) return;
        const hit = entries.find(e => e.el === best.target);
        if (hit) setStage(hit.name);
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.2, 0.5, 1] },
    );

    entries.forEach(e => observer.observe(e.el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
    <div className="lp-bg" data-stage={stage} aria-hidden ref={rootRef}>
      {/* 1 — aurora mesh */}
      <div className="lp-bg-aurora">
        <span className="lp-bg-blob lp-bg-blob--1" />
        <span className="lp-bg-blob lp-bg-blob--2" />
        <span className="lp-bg-blob lp-bg-blob--3" />
        <span className="lp-bg-blob lp-bg-blob--4" />
      </div>

      {/* 2 — dot grid */}
      <div className="lp-bg-grid" />

      {/* 3 — market line that draws itself across the page scroll */}
      <svg
        className="lp-bg-line"
        viewBox="0 0 1440 420"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="lp-bg-line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity="0" />
            <stop offset="18%" stopColor="var(--brand-accent)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path
          className="lp-bg-line-path"
          pathLength={1}
          d="M0,330 C120,300 180,250 260,262 C340,274 380,210 460,196 C540,182 590,240 660,228 C740,214 780,132 870,142 C960,152 1000,96 1080,110 C1160,124 1220,60 1300,52 C1360,46 1400,34 1440,26"
          fill="none"
          stroke="url(#lp-bg-line-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {/* 4 — drifting particles. Scatter is derived from the index rather than
          Math.random so server and client markup always agree. */}
      <div className="lp-bg-particles">
        {PARTICLES.map(i => (
          <span
            key={i}
            className="lp-bg-particle"
            style={
              {
                left: `${(i * 37) % 100}%`,
                top: `${(i * 53) % 100}%`,
                "--n": i,
              } as CSSProperties
            }
          />
        ))}
      </div>

    </div>

    {/* Scroll progress rail — outside the layer so it paints above content */}
    <div className="lp-bg-progress" aria-hidden>
      <span className="lp-bg-progress-fill" />
    </div>
    </>
  );
}
