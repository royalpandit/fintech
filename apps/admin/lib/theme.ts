/**
 * Theme system — dark by default, light available inside the user panel.
 *
 * The product ships dark: every shell (landing, advisor, admin, moderator, auth)
 * is locked to it, and dark is what `:root` carries in theme.css. The one
 * exception is the signed-in user panel, where the header toggle lets a user
 * switch to light for themselves.
 *
 * Scoping is by route rather than by CSS ancestor on purpose. Roughly a hundred
 * rules in theme.css are written as `html[data-theme="dark"] .thing { … }` to
 * rescue pages that carry hardcoded light inline styles; a descendant scope
 * cannot un-apply those, so the attribute has to live on <html>. Light is
 * therefore only ever set while the user is on a /user route — the init script
 * gates on the path before paint, and the user shell reverts to dark when it
 * unmounts.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "finuer-theme";

/** What every shell outside the user panel gets, and the fallback everywhere. */
export const DEFAULT_THEME: Theme = "dark";

/** Only routes under this prefix honour a stored light preference. */
export const THEMED_PATH_PREFIX = "/user";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function isThemedPath(pathname: string | null | undefined): boolean {
  return typeof pathname === "string" && pathname.startsWith(THEMED_PATH_PREFIX);
}

/**
 * Deliberately not `prefers-color-scheme`: the product is dark, and a user on a
 * light-set OS should not silently land in a light panel. Only an explicit
 * in-app choice moves it.
 */
export function getSystemTheme(): Theme {
  return DEFAULT_THEME;
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** The theme a given route should render with. */
export function resolveInitialTheme(pathname?: string): Theme {
  const path =
    pathname ?? (typeof window === "undefined" ? "" : window.location.pathname);
  return isThemedPath(path) ? getStoredTheme() : DEFAULT_THEME;
}

export function applyTheme(theme: Theme = DEFAULT_THEME) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode / storage disabled — the choice just won't survive reload */
  }
}
