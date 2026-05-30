"use client";

import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "./theme-provider";
import type { Theme } from "@/lib/theme";

type Props = {
  variant?: "dropdown" | "inline";
  onSelect?: () => void;
};

export default function ThemeToggleMenu({ variant = "dropdown", onSelect }: Props) {
  const { theme, setTheme } = useTheme();

  const pick = (next: Theme) => {
    setTheme(next);
    onSelect?.();
  };

  if (variant === "inline") {
    return (
      <div className="theme-toggle-inline" role="group" aria-label="Theme">
        <button
          type="button"
          className={`theme-toggle-option${theme === "light" ? " active" : ""}`}
          onClick={() => pick("light")}
          aria-pressed={theme === "light"}
        >
          <FiSun size={15} aria-hidden />
          Light Mode
        </button>
        <button
          type="button"
          className={`theme-toggle-option${theme === "dark" ? " active" : ""}`}
          onClick={() => pick("dark")}
          aria-pressed={theme === "dark"}
        >
          <FiMoon size={15} aria-hidden />
          Dark Mode
        </button>
      </div>
    );
  }

  return (
    <div className="theme-toggle-menu" role="group" aria-label="Theme">
      <div className="theme-toggle-menu-label">Appearance</div>
      <button
        type="button"
        className={`theme-toggle-menu-item${theme === "light" ? " active" : ""}`}
        onClick={() => pick("light")}
        aria-pressed={theme === "light"}
      >
        <FiSun size={16} aria-hidden />
        <span>Light Mode</span>
      </button>
      <button
        type="button"
        className={`theme-toggle-menu-item${theme === "dark" ? " active" : ""}`}
        onClick={() => pick("dark")}
        aria-pressed={theme === "dark"}
      >
        <FiMoon size={16} aria-hidden />
        <span>Dark Mode</span>
      </button>
    </div>
  );
}
