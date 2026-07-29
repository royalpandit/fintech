"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// useLayoutEffect warns when it runs during server rendering; fall back to
// useEffect there. The layout variant matters on the client because it resets
// the displayed value to the start frame *before* the browser paints.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Props = {
  /** Final value. Rendered as-is on the server so the number is in the HTML. */
  to: number;
  from?: number;
  /** Milliseconds. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Pass a locale to group thousands, e.g. "en-IN". Omit for a bare number. */
  locale?: string;
  className?: string;
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Counts up to `to` the first time it scrolls into view. */
export default function Counter({
  to,
  from = 0,
  duration = 1600,
  decimals = 0,
  prefix = "",
  suffix = "",
  locale,
  className,
}: Props) {
  // Start at the final value: that is what the server renders, and what a
  // reduced-motion or no-JS visitor keeps.
  const [value, setValue] = useState(to);
  const ref = useRef<HTMLSpanElement | null>(null);
  const doneRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      doneRef.current = true;
      return;
    }
    setValue(from);
  }, [from]);

  useEffect(() => {
    const node = ref.current;
    if (!node || doneRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || doneRef.current) continue;
          doneRef.current = true;
          observer.unobserve(entry.target);

          const start = performance.now();
          const step = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            setValue(from + (to - from) * easeOutExpo(t));
            if (t < 1) frameRef.current = requestAnimationFrame(step);
          };
          frameRef.current = requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [from, to, duration]);

  const rounded = Number(value.toFixed(decimals));
  const text = locale
    ? rounded.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : rounded.toFixed(decimals);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
