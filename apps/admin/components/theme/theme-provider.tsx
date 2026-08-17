"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_THEME, applyTheme, getStoredTheme, persistTheme, type Theme } from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Adopt the stored preference. The user shell calls this when it mounts. */
  enterThemedScope: () => void;
  /** Return to the product default, leaving the stored choice intact. */
  exitThemedScope: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Holds the active theme and writes it to <html>.
 *
 * It deliberately does not look at the route. This provider sits in the root
 * layout, which the landing page renders statically — calling usePathname()
 * here throws during SSR because there is no router context yet. Scoping is
 * therefore driven by the user shell, the only place light is offered: it calls
 * enterThemedScope() on mount and exitThemedScope() on unmount, so navigating
 * out of /user drops back to dark without discarding the user's choice.
 *
 * State starts at DEFAULT_THEME on both server and client so the first render
 * matches. The pre-paint init script has already put the right attribute on
 * <html>, so a light-mode user sees no flash while the shell's mount effect
 * catches state up.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    persistTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(current => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      persistTheme(next);
      return next;
    });
  }, []);

  const enterThemedScope = useCallback(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const exitThemedScope = useCallback(() => {
    setThemeState(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme, enterThemedScope, exitThemedScope }),
    [theme, setTheme, toggleTheme, enterThemedScope, exitThemedScope],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="theme-root theme-ready">{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
