"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Counter from "@/components/motion/counter";
import type { LandingAdvisor } from "./types";

type Props = {
  advisors: LandingAdvisor[];
};

const AUTOPLAY_MS = 4200;
/** Cards further than this from centre are hidden rather than stacked. */
const VISIBLE_SPAN = 2;
const DRAG_THRESHOLD_PX = 60;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function AdvisorCarousel({ advisors }: Props) {
  const count = advisors.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [dragDx, setDragDx] = useState(0);
  const dragStart = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const go = useCallback(
    (dir: number) => setActive(a => (a + dir + count) % count),
    [count],
  );

  // Autoplay, suspended on hover/focus, while dragging, or when scrolled away.
  useEffect(() => {
    if (count < 2 || paused || !inView || prefersReducedMotion()) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused, inView, go]);

  // Don't animate a carousel nobody is looking at.
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
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragStart.current = e.clientX;
    setPaused(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current == null) return;
    setDragDx(e.clientX - dragStart.current);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current == null) return;
    const dx = e.clientX - dragStart.current;
    dragStart.current = null;
    setDragDx(0);
    setPaused(false);
    if (Math.abs(dx) > DRAG_THRESHOLD_PX) go(dx < 0 ? 1 : -1);
  };

  if (!count) return null;

  return (
    <div
      className="lp-coverflow"
      ref={rootRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className="lp-coverflow-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label="SEBI registered advisors"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {advisors.map((a, i) => {
          // Shortest signed distance around the ring.
          let d = i - active;
          if (d > count / 2) d -= count;
          if (d < -count / 2) d += count;

          const hidden = Math.abs(d) > VISIBLE_SPAN;
          // Nudge the whole ring while dragging for direct-manipulation feel.
          const drag = dragDx / 8;

          const style: CSSProperties = {
            transform: `translateX(calc(-50% + ${d * 58 + drag}%)) translateZ(${
              -Math.abs(d) * 140
            }px) rotateY(${d * -34}deg) scale(${1 - Math.abs(d) * 0.08})`,
            zIndex: count - Math.abs(d),
            opacity: hidden ? 0 : 1,
            pointerEvents: hidden || d !== 0 ? "none" : "auto",
          };

          return (
            <article
              key={a.id}
              className={`lp-cf-card${d === 0 ? " is-active" : ""}`}
              style={style}
              aria-hidden={d !== 0}
            >
              <div className="lp-advisor-photo">
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt="" className="lp-advisor-photo-img" />
                ) : (
                  <span>{a.initials}</span>
                )}
                <span className="lp-advisor-verified" title="SEBI registered">✓</span>
              </div>
              <div className="lp-advisor-body">
                <h3>{a.name}</h3>
                <div className="lp-advisor-meta">SEBI Reg. {a.sebi}</div>
                <div className="lp-advisor-tags">{a.expertise} · {a.years} yrs exp.</div>
                <div className="lp-advisor-return">
                  {a.returnsPct != null ? (
                    <>
                      {d === 0 ? (
                        // Re-mounts per active card so the count-up replays.
                        <Counter key={a.id} to={a.returnsPct} decimals={1} prefix="+" suffix="%" />
                      ) : (
                        <span>+{a.returnsPct.toFixed(1)}%</span>
                      )}
                      <small>Avg. Returns</small>
                    </>
                  ) : (
                    // No measured ROI for this advisor. Show a fact we hold
                    // rather than inventing a performance figure.
                    <>
                      {d === 0 ? (
                        <Counter key={a.id} to={a.followers} locale="en-IN" />
                      ) : (
                        <span>{a.followers.toLocaleString("en-IN")}</span>
                      )}
                      <small>{a.followers === 1 ? "Follower" : "Followers"}</small>
                    </>
                  )}
                </div>
                <Link href="/register" className="lp-btn-follow" tabIndex={d === 0 ? 0 : -1}>
                  Follow
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="lp-coverflow-controls">
        <button
          type="button"
          className="lp-cf-arrow"
          aria-label="Previous advisor"
          onClick={() => go(-1)}
        >
          ‹
        </button>

        <div className="lp-cf-dots" role="tablist" aria-label="Choose advisor">
          {advisors.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Show ${a.name}`}
              className={`lp-cf-dot${i === active ? " is-active" : ""}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>

        <button
          type="button"
          className="lp-cf-arrow"
          aria-label="Next advisor"
          onClick={() => go(1)}
        >
          ›
        </button>
      </div>

      <p className="lp-cf-live" aria-live="polite">
        {advisors[active]?.name}, {active + 1} of {count}
      </p>
    </div>
  );
}
