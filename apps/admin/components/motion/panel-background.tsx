"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Full ambient background for the signed-in user panel.
 *
 * This is the landing page's background system (see landing-background.tsx)
 * rebuilt for the app shell: the same four composited layers — aurora mesh,
 * masked dot grid, self-drawing market line and drifting particles — with the
 * hero palette pinned, since the panel has no marketing sections to stage
 * against.
 *
 * The one structural difference: the user shell locks the viewport
 * (.us-body is height:100vh/overflow:hidden) and scrolls inside .us-main, so
 * window.scrollY is always 0 here. Progress is therefore read off that scroll
 * container and written once per frame into --pbg-sp on the layer root; every
 * bit of motion is expressed from there in CSS, so there are no React
 * re-renders and only transform/opacity animate — it stays on the compositor.
 *
 * The layer is fixed, pointer-events:none and sits below all shell chrome.
 */

/** Scatter is derived from the index, not Math.random, so SSR and client agree. */
const PARTICLES = Array.from({ length: 18 }, (_, i) => i);

export default function PanelBackground() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // .us-main owns the scroll in the user shell; fall back to the window for
    // any shell that scrolls normally.
    const scroller = document.querySelector<HTMLElement>(".us-main");
    let frame = 0;

    const update = () => {
      frame = 0;
      let sp = 0;
      if (scroller) {
        const max = scroller.scrollHeight - scroller.clientHeight;
        if (max > 0) sp = Math.min(1, Math.max(0, scroller.scrollTop / max));
      } else {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0) sp = Math.min(1, Math.max(0, window.scrollY / max));
      }
      root.style.setProperty("--pbg-sp", sp.toFixed(4));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pbg" aria-hidden ref={rootRef}>
      {/* 1 — aurora mesh */}
      <div className="pbg-aurora">
        <span className="pbg-blob pbg-blob--1" />
        <span className="pbg-blob pbg-blob--2" />
        <span className="pbg-blob pbg-blob--3" />
        <span className="pbg-blob pbg-blob--4" />
      </div>

      {/* 2 — dot grid */}
      <div className="pbg-grid" />

      {/* 3 — market line that draws itself across the scroll */}
      <svg
        className="pbg-line"
        viewBox="0 0 1440 420"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="pbg-line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity="0" />
            <stop offset="18%" stopColor="var(--brand-accent)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path
          className="pbg-line-path"
          pathLength={1}
          d="M0,330 C120,300 180,250 260,262 C340,274 380,210 460,196 C540,182 590,240 660,228 C740,214 780,132 870,142 C960,152 1000,96 1080,110 C1160,124 1220,60 1300,52 C1360,46 1400,34 1440,26"
          fill="none"
          stroke="url(#pbg-line-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {/* 4 — drifting particles */}
      <div className="pbg-particles">
        {PARTICLES.map(i => (
          <span
            key={i}
            className="pbg-particle"
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
  );
}
