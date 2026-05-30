import type { CSSProperties } from "react";

/** Theme-aware inline style helpers — prefer CSS classes when possible */
export const themeStyles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
  } satisfies CSSProperties,

  pageCentered: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "var(--bg)",
    color: "var(--text)",
  } satisfies CSSProperties,

  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 18,
    color: "var(--text)",
    boxSizing: "border-box",
  } satisfies CSSProperties,

  cardLg: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 24,
    padding: 40,
    color: "var(--text)",
    boxSizing: "border-box",
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.08)",
  } satisfies CSSProperties,

  heading: {
    margin: 0,
    color: "var(--text)",
    fontWeight: 800,
  } satisfies CSSProperties,

  subheading: {
    margin: 0,
    color: "var(--text-muted)",
  } satisfies CSSProperties,

  label: {
    display: "block",
    marginBottom: 6,
    fontWeight: 600,
    fontSize: 13,
    color: "var(--text)",
  } satisfies CSSProperties,

  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 15,
    boxSizing: "border-box",
  } satisfies CSSProperties,

  select: {
    width: "100%",
    height: 38,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  } satisfies CSSProperties,

  panel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 20,
    color: "var(--text)",
  } satisfies CSSProperties,

  tableWrap: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    overflow: "hidden",
  } satisfies CSSProperties,

  muted: { color: "var(--text-muted)" } satisfies CSSProperties,

  divider: {
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
} as const;
