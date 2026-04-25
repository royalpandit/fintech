"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "user" | "advisor" | "admin";

export default function QuickCreateUser() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
  };

  const submit = async () => {
    setError("");
    setSuccess("");

    if (fullName.trim().length < 2) return setError("Name required");
    if (!email.includes("@")) return setError("Valid email required");
    if (phone.replace(/\D/g, "").length < 10) return setError("Valid phone required");
    if (password.length < 8) return setError("Password min 8 chars");

    setLoading(true);
    try {
      const response = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim().replace(/\s|-/g, ""),
          password,
          role,
          status: "active",
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed to create");
        setLoading(false);
        return;
      }
      setSuccess(`${role.charAt(0).toUpperCase() + role.slice(1)} created.`);
      reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    display: "block",
    marginBottom: 4,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 36,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid #eef0f4",
    background: "#fff",
    fontSize: 12,
    color: "#334155",
    outline: "none",
    marginBottom: 10,
    boxSizing: "border-box",
  };

  return (
    <article className="widget">
      <div className="widget-title">
        <h3>Quick User Create</h3>
        <Link href="/super-admin/users/create">Full form</Link>
      </div>

      <label style={labelStyle}>Full Name</label>
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Jane Doe"
        style={inputStyle}
      />

      <label style={labelStyle}>Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        placeholder="jane@example.com"
        style={inputStyle}
      />

      <label style={labelStyle}>Phone</label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        type="tel"
        placeholder="+919999999999"
        style={inputStyle}
      />

      <label style={labelStyle}>Role</label>
      <div className="bs-toggle" style={{ marginBottom: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <button
          type="button"
          onClick={() => setRole("user")}
          className={`bs-toggle-item ${role === "user" ? "active buy" : ""}`}
          style={role === "user" ? { background: "#2563eb" } : undefined}
        >
          User
        </button>
        <button
          type="button"
          onClick={() => setRole("advisor")}
          className={`bs-toggle-item ${role === "advisor" ? "active buy" : ""}`}
        >
          Advisor
        </button>
        <button
          type="button"
          onClick={() => setRole("admin")}
          className={`bs-toggle-item ${role === "admin" ? "active sell" : ""}`}
          style={role === "admin" ? { background: "#7c3aed" } : undefined}
        >
          Admin
        </button>
      </div>

      <label style={labelStyle}>Initial Password</label>
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="Min 8 chars"
        style={inputStyle}
      />

      {role === "advisor" && (
        <div
          style={{
            padding: "8px 10px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            fontSize: 11,
            color: "#92400e",
            marginBottom: 10,
          }}
        >
          Advisors require a SEBI registration number. Use the{" "}
          <Link
            href="/super-admin/users/create"
            style={{ color: "#92400e", fontWeight: 700, textDecoration: "underline" }}
          >
            full form
          </Link>{" "}
          to set this.
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "8px 10px",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 8,
            fontSize: 11,
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "8px 10px",
            background: "#f0fdf4",
            color: "#047857",
            borderRadius: 8,
            fontSize: 11,
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          {success}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={loading || role === "advisor"}
        className="cta-place"
        style={{
          opacity: loading || role === "advisor" ? 0.5 : 1,
          cursor: loading || role === "advisor" ? "not-allowed" : "pointer",
          background: "#7c3aed",
        }}
      >
        {loading ? "Creating..." : "Create User"}
      </button>
    </article>
  );
}
