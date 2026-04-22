"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "user" | "advisor";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("user");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sebi, setSebi] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          role,
          ...(role === "advisor"
            ? {
                sebiRegistrationNo: sebi.trim().toUpperCase(),
                experienceYears: experienceYears ? Number(experienceYears) : undefined,
                bio: bio.trim() || undefined,
              }
            : {}),
        }),
      });
      const data = await response.json();

      if (!response.ok || data.status === false) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      router.push(data.redirectTo || "/user/home");
      router.refresh();
    } catch (e) {
      setError("Network error — please try again");
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d1d9e6",
    marginBottom: 16,
    fontSize: 15,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontWeight: 600,
    fontSize: 13,
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f4f7fb" }}>
      <div style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 24, boxShadow: "0 24px 80px rgba(15, 23, 42, 0.08)", padding: 40 }}>
        <h1 style={{ margin: 0, marginBottom: 8, fontSize: 28 }}>Create your account</h1>
        <p style={{ margin: 0, marginBottom: 28, color: "#61708b" }}>
          Join as a community member or a SEBI-registered advisor.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => setRole("user")}
            style={{
              padding: "16px 12px",
              borderRadius: 14,
              border: role === "user" ? "2px solid #2563eb" : "1px solid #d1d9e6",
              background: role === "user" ? "#eff6ff" : "#fff",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Normal User</div>
            <div style={{ fontSize: 12, color: "#61708b" }}>
              Track portfolio, expenses, learn & engage with the community.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setRole("advisor")}
            style={{
              padding: "16px 12px",
              borderRadius: 14,
              border: role === "advisor" ? "2px solid #2563eb" : "1px solid #d1d9e6",
              background: role === "advisor" ? "#eff6ff" : "#fff",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>SEBI Advisor</div>
            <div style={{ fontSize: 12, color: "#61708b" }}>
              Publish regulated sentiment, run courses, monetize insights.
            </div>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="As per KYC"
            required
            style={inputStyle}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919999999999"
                autoComplete="tel"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, letters + numbers"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {role === "advisor" && (
            <div style={{ padding: 16, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 16 }}>
              <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
                SEBI Advisor Details
              </p>

              <label style={labelStyle}>SEBI Registration Number</label>
              <input
                type="text"
                value={sebi}
                onChange={(e) => setSebi(e.target.value.toUpperCase())}
                placeholder="INA000012345"
                required
                style={inputStyle}
              />

              <label style={labelStyle}>Years of Experience</label>
              <input
                type="number"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="e.g. 5"
                min={0}
                max={60}
                style={inputStyle}
              />

              <label style={labelStyle}>Short Bio (optional)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Your advisory focus, strategy, credentials..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />

              <p style={{ margin: 0, fontSize: 12, color: "#61708b" }}>
                Your account will be created as <strong>Pending Verification</strong>. An admin will review your SEBI registration before your advisor capabilities are enabled.
              </p>
            </div>
          )}

          {error && (
            <div style={{ color: "#b91c1c", marginBottom: 16, fontSize: 14, padding: "10px 12px", background: "#fef2f2", borderRadius: 10 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "14px 16px", background: loading ? "#93a4c8" : "#2563eb", color: "#fff", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 600 }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: "center", color: "#61708b", fontSize: 14 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#2563eb", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
