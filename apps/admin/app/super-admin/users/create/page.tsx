"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "user" | "advisor" | "admin" | "super_admin";
type Status = "active" | "pending" | "suspended";

export default function CreateUserPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [status, setStatus] = useState<Status>("active");
  const [sebi, setSebi] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [bio, setBio] = useState("");
  const [autoApproveAdvisor, setAutoApproveAdvisor] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
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
      const response = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim().replace(/\s|-/g, ""),
          password,
          role,
          status,
          ...(role === "advisor"
            ? {
                sebiRegistrationNo: sebi.trim().toUpperCase(),
                experienceYears: experienceYears ? Number(experienceYears) : undefined,
                bio: bio.trim() || undefined,
                autoApproveAdvisor,
              }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed to create user");
        setLoading(false);
        return;
      }
      router.push("/super-admin/users");
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <section>
      <p className="page-subtitle" style={{ marginTop: 0 }}>
        Users / Create User
      </p>
      <h1 className="page-title">Create New User</h1>
      <p className="page-subtitle">
        Set identity, role, status, and access scope for the account.
      </p>

      <form onSubmit={submit}>
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16 }}>
          <article className="card">
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <p className="metric-label">Full Name</p>
                <input
                  className="input"
                  placeholder="e.g. Jonathan Ive"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <p className="metric-label">Email Address</p>
                <input
                  className="input"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <p className="metric-label">Phone</p>
                <input
                  className="input"
                  type="tel"
                  placeholder="+91 9999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <p className="metric-label">Role</p>
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="user">User</option>
                  <option value="advisor">Advisor</option>
                  <option value="admin">Admin (moderator)</option>
                  <option value="super_admin">Super Admin (governance)</option>
                </select>
              </div>
              <div>
                <p className="metric-label">Password</p>
                <input
                  className="input"
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <p className="metric-label">Confirm Password</p>
                <input
                  className="input"
                  type="password"
                  placeholder="********"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <p className="metric-label">Status</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["active", "pending", "suspended"] as Status[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={status === s ? "btn-primary" : "input"}
                      style={{ width: "auto", padding: "10px 16px", textTransform: "capitalize" }}
                      onClick={() => setStatus(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {role === "advisor" && (
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p style={{ margin: 0, marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
                  SEBI Advisor Details
                </p>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <p className="metric-label">SEBI Registration No</p>
                    <input
                      className="input"
                      placeholder="INA000012345"
                      value={sebi}
                      onChange={(e) => setSebi(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div>
                    <p className="metric-label">Experience (years)</p>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 5"
                      min={0}
                      max={60}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <p className="metric-label">Bio (optional)</p>
                  <textarea
                    className="input"
                    rows={3}
                    style={{ resize: "vertical" }}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={autoApproveAdvisor}
                    onChange={(e) => setAutoApproveAdvisor(e.target.checked)}
                  />
                  Auto-approve advisor verification (skip pending queue)
                </label>
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: 16,
                  padding: "10px 12px",
                  color: "#b91c1c",
                  background: "#fef2f2",
                  borderRadius: 10,
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <Link
                href="/super-admin/users"
                className="input"
                style={{ width: "auto", padding: "12px 20px", textDecoration: "none", color: "inherit" }}
              >
                Cancel
              </Link>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Creating..." : "Create User"}
              </button>
            </div>
          </article>

          <article className="card">
            <h3 style={{ marginTop: 0 }}>Quick Guidance</h3>
            <p className="page-subtitle">Assign only minimum required permissions during onboarding.</p>
            <div className="card" style={{ marginTop: 12 }}>
              <p style={{ marginTop: 0, fontWeight: 600 }}>Password policy</p>
              <p className="page-subtitle">
                Minimum 8 characters with at least one letter and one number.
              </p>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <p style={{ marginTop: 0, fontWeight: 600 }}>Advisor verification</p>
              <p className="page-subtitle">
                SEBI registration number is validated (format: INA followed by 9 digits). Uncheck
                auto-approve to require manual review.
              </p>
            </div>
            <div className="card" style={{ marginTop: 12 }}>
              <p style={{ marginTop: 0, fontWeight: 600 }}>Audit</p>
              <p className="page-subtitle">
                All user creation events are logged in the audit module with your admin ID.
              </p>
            </div>
          </article>
        </div>
      </form>
    </section>
  );
}
