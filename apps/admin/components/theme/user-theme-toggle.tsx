"use client";

import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/components/theme/theme-provider";

/**
 * Light/dark toggle for the user panel header.
 *
 * Kept separate from ThemeHeaderButton, which stays a no-op: that one is
 * rendered by six other shells (advisor, admin, moderator, landing, login,
 * register) and those are locked dark, so making it render would put a live
 * control everywhere. This component is mounted only by user-shell.tsx.
 *
 * Both icons are always in the DOM and CSS picks which one shows, keyed off the
 * data-theme attribute the init script sets before paint. Driving it from React
 * state instead would render the dark icon on the server and swap it after
 * hydration, which a light-mode user sees as a flicker on every page load.
 */
export default function UserThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="us-icon-btn us-theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      <FiSun size={18} className="us-theme-icon us-theme-icon--sun" />
      <FiMoon size={18} className="us-theme-icon us-theme-icon--moon" />
    </button>
  );
}
