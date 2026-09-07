"use client";

import { useEffect, useState } from "react";

/**
 * A counter that changes whenever the user switches light/dark.
 *
 * Canvas-rendered charts cannot use CSS custom properties the way the DOM can.
 * lightweight-charts does resolve a `var(--x)` colour string — it sets it on a
 * probe element and reads the computed value back — but it does that once, when
 * the colour first reaches the renderer, and caches the result for the life of
 * that chart instance. So a chart created in light mode keeps painting light
 * grid lines and a white background after the user switches to dark; nothing
 * re-reads the variable.
 *
 * Feeding this into a chart effect's dependency list rebuilds the chart on a
 * theme change, which re-resolves every colour. Toggling the theme is a rare,
 * deliberate action, so paying for a rebuild is cheaper than threading
 * applyOptions through the main chart, every lower pane and every series.
 *
 * lib/theme.ts sets `data-theme` on <html>, which is what this observes.
 */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    let last = root.getAttribute("data-theme");

    const observer = new MutationObserver(() => {
      const next = root.getAttribute("data-theme");
      // attributeFilter still fires for same-value writes; only a real change
      // should cost a chart rebuild.
      if (next === last) return;
      last = next;
      setVersion((v) => v + 1);
    });

    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return version;
}
