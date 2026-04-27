"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4f7fb" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 24, boxShadow: "0 24px 80px rgba(15, 23, 42, 0.08)", padding: 40 }}>
        <h1 style={{ margin: 0, marginBottom: 8, fontSize: 28 }}>Sign in</h1>
        <p style={{ margin: 0, marginBottom: 28, color: "#61708b" }}>
          Use your registered email or phone to continue.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Email or Phone
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="name@example.com or +919999999999"
            autoComplete="username"
            required
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #d1d9e6", marginBottom: 20, fontSize: 16, boxSizing: "border-box" }}
          />

          <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #d1d9e6", marginBottom: 20, fontSize: 16, boxSizing: "border-box" }}
          />

          {error && (
            <div style={{ color: "#b91c1c", marginBottom: 20, fontSize: 14, padding: "10px 12px", background: "#fef2f2", borderRadius: 10 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "14px 16px", background: loading ? "#93a4c8" : "#2563eb", color: "#fff", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 600 }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: "center", color: "#61708b", fontSize: 14 }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "#2563eb", fontWeight: 600 }}>
            Create one
          </Link>
        </p>

        <p style={{ marginTop: 12, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          or{" "}
          <Link href="/user/home" style={{ color: "#0ea5e9", fontWeight: 600 }}>
            browse without an account →
          </Link>
        </p>
      </div>
    </main>
  );
}
