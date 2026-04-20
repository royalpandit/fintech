"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok || data.status === false) {
      setError(data.error || "Login failed");
      return;
    }

    router.push("/super-admin/dashboard");
  };

  return (
    <main className="login-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4f7fb" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24, boxShadow: "0 24px 80px rgba(15, 23, 42, 0.08)", padding: 40 }}>
        <h1 style={{ margin: 0, marginBottom: 16, fontSize: 28 }}>Admin Sign In</h1>
        <p style={{ margin: 0, marginBottom: 28, color: "#61708b" }}>Use your registered admin account to access the dashboard.</p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: 12, fontWeight: 600 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #d1d9e6", marginBottom: 20, fontSize: 16 }}
          />

          <label style={{ display: "block", marginBottom: 12, fontWeight: 600 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #d1d9e6", marginBottom: 20, fontSize: 16 }}
          />

          {error && (
            <div style={{ color: "#b91c1c", marginBottom: 20, fontSize: 14 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "14px 16px", background: "#2563eb", color: "#fff", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 600 }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
