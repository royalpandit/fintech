export const BRAND_NAME = "Finuer";
export const BRAND_TAGLINE = "Learn. Invest. Connect. Grow.";
/** Dark wordmark + gradient icon — for light theme backgrounds */
export const BRAND_LOGO_SRC = "/finuer-logo.png";
/** White wordmark + gradient icon — for dark / black theme backgrounds */
export const BRAND_LOGO_DARK_SRC = "/finuer-logo-dark.png";
export const BRAND_SUPPORT_EMAIL = "support@finuer.ai";

/** Finuer brand palette — use in JS/charts; CSS mirrors these as --brand-* tokens */
export const BRAND_COLORS = {
  primary: "#0EA5E9",
  primaryDark: "#0284C7",
  accent: "#06B6D4",
  navy: "#0F172A",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",
  light: {
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    sidebar: "#FFFFFF",
    border: "#E2E8F0",
    text: "#0F172A",
    textMuted: "#64748B",
    hover: "#F1F5F9",
    chartBg: "#FFFFFF",
    chartGrid: "#E2E8F0",
  },
  dark: {
    bg: "#020617",
    surface: "#0F172A",
    sidebar: "#111827",
    border: "#1E293B",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    hover: "#1E293B",
    chartBg: "#0F172A",
    chartGrid: "#1E293B",
  },
} as const;
