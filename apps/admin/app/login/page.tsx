"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FinuerLogo from "@/components/brand/finuer-logo";
import ThemeHeaderButton from "@/components/theme/theme-header-button";

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
    <main className="theme-auth-page">
      <ThemeHeaderButton />
      <div className="theme-auth-card" style={{ maxWidth: 440, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <FinuerLogo href="/" height={44} />
        </div>
        <h1 style={{ margin: 0, marginBottom: 8, fontSize: 28 }}>Sign in</h1>
        <p className="theme-auth-muted" style={{ margin: 0, marginBottom: 28 }}>
          Use your registered email or phone to continue.
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

          <label className="theme-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="theme-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            style={{ marginBottom: 20 }}
          />

          {error && <div className="theme-error" style={{ marginBottom: 20 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "14px 16px", background: loading ? "#93a4c8" : "#2563eb", color: "#fff", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 600 }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="theme-auth-muted" style={{ marginTop: 24, textAlign: "center", fontSize: 14 }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>
            Create one
          </Link>
        </p>

        <p className="theme-auth-muted" style={{ marginTop: 12, textAlign: "center", fontSize: 13, opacity: 0.85 }}>
          or{" "}
          <Link href="/" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>
            browse without an account →
          </Link>
        </p>
      </div>
    </main>
  );
}
