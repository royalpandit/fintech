"use client";

import Link from "next/link";
import { useState, ReactNode } from "react";

type Props = {
  isAuthenticated: boolean;
  children: ReactNode;
  promptTitle?: string;
  promptDescription?: string;
};

export default function AuthGate({
  isAuthenticated,
  children,
  promptTitle = "Sign in to continue",
  promptDescription = "You need an account to use this feature. It only takes a minute.",
}: Props) {
  const [open, setOpen] = useState(false);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        style={{ cursor: "pointer", display: "contents" }}
      >
        {children}
      </span>

      {open && (
        <div className="theme-modal-overlay" onClick={() => setOpen(false)}>
          <div className="theme-modal-card" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(90deg, var(--brand-primary), var(--brand-accent))",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontSize: 22,
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              ✦
            </div>
            <h2 className="theme-heading" style={{ fontSize: 20, letterSpacing: -0.4 }}>
              {promptTitle}
            </h2>
            <p className="theme-muted" style={{ margin: "8px 0 20px", fontSize: 14, lineHeight: 1.5 }}>
              {promptDescription}
            </p>

            <div style={{ display: "grid", gap: 8 }}>
              <Link href="/register" className="theme-btn-primary">
                Create account
              </Link>
              <Link href="/login" className="theme-btn-secondary">
                I already have an account
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="theme-muted"
              style={{
                marginTop: 14,
                width: "100%",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
