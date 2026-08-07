"use client";

import { useState } from "react";
import { FiSmartphone } from "react-icons/fi";

// Google + mobile-OTP sign-in options. UI only for now — the providers/APIs
// are wired later; clicking shows a "coming soon" note.
export default function AltLoginMethods({ mode = "sign in" }: { mode?: string }) {
  const [note, setNote] = useState("");

  const btn: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 16px" }}>
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>or</span>
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <button type="button" style={btn} onClick={() => setNote(`Google ${mode} will be enabled soon.`)}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.5 7l7 5.4c4.1-3.8 6.7-9.4 6.7-16.9z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.4 0 11.9-2.1 15.8-5.8l-7-5.4c-2 1.4-4.6 2.2-8.8 2.2-6.3 0-11.6-3.7-13.5-8.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Continue with Google
        </button>
        <button type="button" style={btn} onClick={() => setNote(`Mobile OTP ${mode} will be enabled soon.`)}>
          <FiSmartphone size={18} />
          Continue with mobile OTP
        </button>
      </div>

      {note && (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--text-muted)", textAlign: "center" }}>
          {note}
        </p>
      )}
    </div>
  );
}
