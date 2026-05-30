"use client";

import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "./theme-provider";

export default function ThemeHeaderButton() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-header-btn"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? <FiSun size={17} /> : <FiMoon size={17} />}
    </button>
  );
}
