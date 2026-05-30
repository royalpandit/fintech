"use client";

import { useTheme } from "./theme-provider";

export default function ThemeSettingsField() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <label className="theme-settings-label" htmlFor="finuer-theme-select">
        Theme
      </label>
      <select
        id="finuer-theme-select"
        className="theme-settings-select"
        value={theme}
        onChange={(e) => setTheme(e.target.value as "light" | "dark")}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </>
  );
}
