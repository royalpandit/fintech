import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMED_PATH_PREFIX } from "@/lib/theme";

/**
 * Runs before paint so the panel never flashes the wrong appearance.
 *
 * Mirrors resolveInitialTheme() in lib/theme.ts, inlined as a string because it
 * has to execute ahead of hydration. Light is only honoured under the user
 * panel prefix — every other route is pinned dark regardless of what is stored.
 */
export default function ThemeInitScript() {
  const script = `
(function () {
  try {
    var stored = null;
    try { stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch (e) {}
    var scoped = location.pathname.indexOf(${JSON.stringify(THEMED_PATH_PREFIX)}) === 0;
    var theme = (scoped && (stored === "light" || stored === "dark"))
      ? stored
      : ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
  // Gates the scroll-reveal hidden state. Without JS the class never lands,
  // so .reveal elements stay fully visible instead of being stuck at opacity 0.
  try {
    document.documentElement.classList.add("has-js");
  } catch (e) {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
