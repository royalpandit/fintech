"use client";

import Link from "next/link";
import { useState, ReactNode } from "react";

type Props = {
  isAuthenticated: boolean;
  children: ReactNode;
  /** Title for the prompt modal */
  promptTitle?: string;
  /** Reason shown on the modal */
  promptDescription?: string;
};

/**
 * Wraps a clickable area. If the user is logged in, the children render normally.
 * If the user is a guest, clicking opens a sign-in prompt modal that links to login + register.
 */
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
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              borderRadius: 18,
              padding: 28,
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.18)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "linear-gradient(135deg, #0ea5e9, #10b981)",
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
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: -0.4,
              }}
            >
              {promptTitle}
            </h2>
            <p
              style={{
                margin: "8px 0 20px",
                fontSize: 14,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              {promptDescription}
            </p>

            <div style={{ display: "grid", gap: 8 }}>
              <Link
                href="/register"
                style={{
                  display: "block",
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0ea5e9, #10b981)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                Create account
              </Link>
              <Link
                href="/login"
                style={{
                  display: "block",
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #eef0f4",
                  color: "#0f172a",
                  fontWeight: 600,
                  fontSize: 14,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                I already have an account
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                color: "#64748b",
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
