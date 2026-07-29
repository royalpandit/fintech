"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { DashboardMock, FeedMock, VirtualLabMock } from "./landing-mockups";

const SLIDES = [
  {
    key: "dashboard",
    label: "Portfolio",
    title: "Your whole portfolio, one glance",
    desc: "Holdings, P&L and daily snapshots with charts that actually read well.",
    render: () => <DashboardMock />,
  },
  {
    key: "lab",
    label: "Virtual Lab",
    title: "Practice without the risk",
    desc: "A real-time simulated market with ₹10,00,000 of virtual cash and a full order book.",
    render: () => <VirtualLabMock />,
  },
  {
    key: "feed",
    label: "FinMedia Feed",
    title: "Learn from the community",
    desc: "Follow advisors and investors, track trending tickers, and share your own setups.",
    render: () => <FeedMock />,
  },
];

const AUTOPLAY_MS = 5200;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Stacked 3D deck — the active screen sits in front and the rest recede along
 * the Z axis. Deliberately a different motion from the advisor coverflow so the
 * two carousels on this page don't read as duplicates.
 */
export default function ProductSlider() {
  const count = SLIDES.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const go = useCallback(
    (dir: number) => setActive(a => (a + dir + count) % count),
    [count],
  );

  useEffect(() => {
    if (paused || !inView || prefersReducedMotion()) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, inView, go]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const current = SLIDES[active];

  return (
    <div
      className="lp-deck"
      ref={rootRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="lp-deck-tabs" role="tablist" aria-label="Product screens">
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            id={`lp-deck-tab-${s.key}`}
            aria-selected={i === active}
            aria-controls={`lp-deck-panel-${s.key}`}
            className={`lp-deck-tab${i === active ? " is-active" : ""}`}
            onClick={() => setActive(i)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="lp-deck-stage">
        {SLIDES.map((s, i) => {
          const offset = (i - active + count) % count;
          const style: CSSProperties = {
            transform: `translate(-50%, ${offset * 24}px) translateZ(${
              -offset * 150
            }px) rotateX(${offset * 2}deg) scale(${1 - offset * 0.06})`,
            zIndex: count - offset,
            opacity: offset > 2 ? 0 : 1 - offset * 0.22,
            pointerEvents: offset === 0 ? "auto" : "none",
          };

          return (
            <div
              key={s.key}
              className={`lp-deck-slide${offset === 0 ? " is-active" : ""}`}
              style={style}
              role="tabpanel"
              id={`lp-deck-panel-${s.key}`}
              aria-labelledby={`lp-deck-tab-${s.key}`}
              aria-hidden={offset !== 0}
            >
              {s.render()}
            </div>
          );
        })}
      </div>

      <div className="lp-deck-caption">
        <div className="lp-deck-copy" key={current.key}>
          <h3>{current.title}</h3>
          <p>{current.desc}</p>
        </div>
        <div className="lp-deck-nav">
          <button
            type="button"
            className="lp-cf-arrow"
            aria-label="Previous screen"
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="lp-cf-arrow"
            aria-label="Next screen"
            onClick={() => go(1)}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
