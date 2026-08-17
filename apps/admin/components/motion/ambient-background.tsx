"use client";

import { useEffect } from "react";

/**
 * Lightweight ambient background for non-landing pages.
 *
 * Same visual language as the home page (drifting emerald aurora + masked dot
 * grid) but deliberately trimmed: no particles, no self-drawing market line,
 * no scroll-stage palette system and no progress rail. Those extras suit a
 * marketing page; behind dense application UI they cost frames and compete
 * with the content.
 *
 * Pure CSS animation — no scroll listener and no React re-renders — so the
 * cost is a couple of composited layers and nothing on the main thread.
 */
export default function AmbientBackground() {
  // The dot grid's mask is authored against --sp; app pages don't track
  // scroll, so pin it once to keep the layer static.
  useEffect(() => {
    document.documentElement.style.setProperty("--sp", "0");
  }, []);

  return (
    <div className="app-bg" aria-hidden>
      <span className="app-bg-blob app-bg-blob--1" />
      <span className="app-bg-blob app-bg-blob--2" />
      <span className="app-bg-blob app-bg-blob--3" />
      <div className="app-bg-grid" />
    </div>
  );
}
