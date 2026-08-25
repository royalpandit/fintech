/**
 * Theme system — dark by default, light available inside the signed-in panels.
 *
 * The product opens dark: that is DEFAULT_THEME and what `:root` carries in
 * theme.css. Every surface then offers a toggle — the landing header, the
 * login / register topbar, and the user, advisor, super-admin and moderator
 * panels — and the choice is remembered across the whole app.
 *
 * Scoping is by route rather than by CSS ancestor on purpose. Roughly a hundred
 * rules in theme.css are written as `html[data-theme="dark"] .thing { … }` to
 * rescue pages that carry hardcoded light inline styles; a descendant scope
 * cannot un-apply those, so the attribute has to live on <html>. Light is
 * therefore only ever set while on one of the panel routes below — the init
 * script gates on the path before paint, and each shell reverts to dark when it
 * unmounts.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "finuer-theme";

/** What every surface outside the signed-in panels gets, and the fallback. */
export const DEFAULT_THEME: Theme = "dark";

/**
 * Every route now honours a stored light preference: the landing header and the
 * login / register topbar carry a toggle alongside the four signed-in panels, so
 * gating by path would have let a visitor flip the switch and then snap back to
 * dark on the next navigation.
 *
 * DEFAULT_THEME still governs a first visit with nothing stored, so the product
 * continues to open dark.
 */
export const THEMED_PATH_PREFIXES = ["/"] as const;

/** @deprecated single-prefix alias, kept so any older import keeps resolving. */
export const THEMED_PATH_PREFIX = THEMED_PATH_PREFIXES[0];

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function isThemedPath(pathname: string | null | undefined): boolean {
  return (
    typeof pathname === "string" &&
    THEMED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
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
