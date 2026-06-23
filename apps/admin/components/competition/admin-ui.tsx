"use client";

import type { CSSProperties, ReactNode } from "react";

function getToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
  if (m) return m[1];
  const t = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return t ? t[1] : null;
}

export async function competitionApi(path: string, opts?: RequestInit) {
  const t = getToken();
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...opts?.headers,
    },
  });
}

export const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

export const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "2px solid var(--border)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
};

export function Panel({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      {title ? <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800 }}>{title}</h2> : null}
      {children}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const bg =
    variant === "danger"
      ? "#ef4444"
      : variant === "ghost"
        ? "transparent"
        : "var(--primary, #0ea5e9)";
  const color = variant === "ghost" ? "var(--text)" : "#fff";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        border: variant === "ghost" ? "1px solid var(--border)" : "none",
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
