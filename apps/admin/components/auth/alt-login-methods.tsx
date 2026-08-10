"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiSmartphone } from "react-icons/fi";

type OtpStep = "idle" | "phone" | "code";

export default function AltLoginMethods({ mode = "sign in" }: { mode?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<OtpStep>("idle");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.status) {
        setError(data.error || "Failed to send OTP");
        return;
      }
      setStep("code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.status) {
        setError(data.error || "Invalid OTP");
        return;
      }
      router.push(data.redirectTo || "/user/feed");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 16px" }}>
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>or</span>
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      {step === "idle" && (
        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            style={btn}
            onClick={() => { window.location.href = "/api/v1/auth/google"; }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.5 7l7 5.4c4.1-3.8 6.7-9.4 6.7-16.9z" />
              <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.4 0 11.9-2.1 15.8-5.8l-7-5.4c-2 1.4-4.6 2.2-8.8 2.2-6.3 0-11.6-3.7-13.5-8.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
            </svg>
            Continue with Google
          </button>
          <button
            type="button"
            style={btn}
            onClick={() => { setStep("phone"); setError(""); }}
          >
            <FiSmartphone size={18} />
            Continue with mobile OTP
          </button>
        </div>
      )}

      {step === "phone" && (
        <form onSubmit={handleSendOTP} style={{ display: "grid", gap: 10 }}>
          <input
            style={inputStyle}
            type="tel"
            placeholder="Mobile number (e.g. 9876543210)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoFocus
          />
          {error && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger, #dc2626)" }}>{error}</p>
          )}
          <button
            type="submit"
            style={{ ...btn, background: "#059669", color: "#fff", border: "none", opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? "Sending…" : "Send OTP"}
          </button>
          <button
            type="button"
            style={{ ...btn, fontSize: 13 }}
            onClick={() => { setStep("idle"); setError(""); setPhone(""); }}
          >
            ← Back
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleVerifyOTP} style={{ display: "grid", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            OTP sent to <strong>{phone}</strong>
          </p>
          <input
            style={{ ...inputStyle, letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: 700 }}
            type="text"
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
          />
          {error && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger, #dc2626)" }}>{error}</p>
          )}
          <button
            type="submit"
            style={{ ...btn, background: "#059669", color: "#fff", border: "none", opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? "Verifying…" : `Verify & ${mode === "sign in" ? "Sign in" : "Continue"}`}
          </button>
          <button
            type="button"
            style={{ ...btn, fontSize: 13 }}
            disabled={loading}
            onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
          >
            ← Change number / Resend
          </button>
        </form>
      )}
    </div>
  );
}
