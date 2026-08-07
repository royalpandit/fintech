"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PasswordField from "@/components/auth/password-field";
import AltLoginMethods from "@/components/auth/alt-login-methods";
import AuthSplitLayout from "@/components/auth/auth-split-layout";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await response.json();

      if (!response.ok || data.status === false) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      router.push(data.redirectTo || "/super-admin/dashboard");
      router.refresh();
    } catch (e) {
      setError("Network error — please try again");
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout variant="sign-in">
      <h1 style={{ margin: 0, marginBottom: 8, fontSize: 26 }}>Welcome back</h1>
      <p className="theme-auth-muted" style={{ margin: 0, marginBottom: 26, fontSize: 14 }}>
        Sign in with your registered email or phone to continue.
      </p>

      <form onSubmit={handleSubmit}>
          <label className="theme-label" htmlFor="login-identifier">
            Email or Phone
          </label>
          <input
            id="login-identifier"
            className="theme-input"
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="name@example.com or +919999999999"
            autoComplete="username"
            required
            style={{ marginBottom: 20 }}
          />

          <PasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="Enter your password"
            autoComplete="current-password"
          />

          {error && <div className="theme-error" style={{ marginBottom: 20 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "14px 16px", background: loading ? "#6ee7b7" : "linear-gradient(135deg, #059669 0%, #10b981 55%, #34d399 100%)", color: "#fff", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 600 }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

      <AltLoginMethods mode="sign in" />

      <p className="theme-auth-muted" style={{ marginTop: 20, textAlign: "center", fontSize: 13, opacity: 0.85 }}>
        or{" "}
        <Link href="/" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>
          browse without an account →
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
