"use client";

import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/components/theme/theme-provider";

/**
 * The live light/dark toggle, used by every surface that offers one: the
 * advisor / super-admin / moderator headers, the landing header and the
 * login / register topbar.
 *
 * ThemeHeaderButton stays a no-op — it is still imported in a couple of places
 * and returning null there is harmless; this is the component that actually
 * switches.
 *
 * Both icons are always in the DOM and CSS picks which one shows, keyed off the
 * data-theme attribute the init script sets before paint. Driving it from React
 * state instead would render the dark icon on the server and swap it after
 * hydration, which a light-mode user sees as a flicker on every page load.
 * `className` selects the host surface's styling; the icon-swap rules in
 * theme.css are written against each of them.
 */
export default function PanelThemeToggle({
  className = "admin-theme-toggle",
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button type="button" className={className} onClick={toggleTheme} aria-label={label} title={label}>
      <FiSun size={size} className="theme-icon theme-icon--sun" />
      <FiMoon size={size} className="theme-icon theme-icon--moon" />
    </button>
  );
}
