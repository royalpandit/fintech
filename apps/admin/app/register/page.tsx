"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FinuerLogo from "@/components/brand/finuer-logo";
import ThemeHeaderButton from "@/components/theme/theme-header-button";
import { PROFESSIONAL_TYPES, type ProfessionalType } from "@/lib/professional-types";

type Role = "user" | "advisor";

// The registration/licence field adapts to the chosen profession.
const REG_FIELD: Record<ProfessionalType, { label: string; placeholder: string }> = {
  research_analyst: { label: "SEBI Research Analyst No.", placeholder: "INH000012345" },
  investment_advisor: { label: "SEBI RIA Registration No.", placeholder: "INA000012345" },
  portfolio_manager: { label: "SEBI PMS Registration No.", placeholder: "INP000012345" },
  wealth_manager: { label: "Registration / Licence No.", placeholder: "Your licence number" },
  advisory_firm: { label: "SEBI Firm Registration No.", placeholder: "INA / INH number" },
  mutual_fund_distributor: { label: "AMFI ARN", placeholder: "ARN-123456" },
  stock_broker: { label: "Broker / Member Code", placeholder: "NSE-BR-004567" },
  finance_creator: { label: "Handle / Website / ID", placeholder: "@yourhandle or website" },
  listed_company: { label: "Listing ID / CIN", placeholder: "NSE:SYMBOL or CIN" },
  financial_platform: { label: "Business / Licence ID", placeholder: "Company registration ID" },
};

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("user");
  const [professionalType, setProfessionalType] = useState<ProfessionalType>("investment_advisor");
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
                professionalType,
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
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  };

  return (
    <main className="theme-auth-page">
      <ThemeHeaderButton />
      <div className="theme-auth-card" style={{ maxWidth: 520, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <FinuerLogo href="/" height={44} />
        </div>
        <h1 style={{ margin: 0, marginBottom: 8, fontSize: 28 }}>Create your account</h1>
        <p className="theme-auth-muted" style={{ margin: 0, marginBottom: 28 }}>
          Join as a community member or a finance professional.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => setRole("user")}
            className={`theme-role-option${role === "user" ? " active" : ""}`}
          >
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Normal User</div>
            <div className="theme-role-option-desc">
              Track portfolio, expenses, learn & engage with the community.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setRole("advisor")}
            className={`theme-role-option${role === "advisor" ? " active" : ""}`}
          >
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Finance Professional</div>
            <div className="theme-role-option-desc">
              Advisors, analysts, distributors, brokers, creators & more.
            </div>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="theme-label" htmlFor="register-name">
            Full Name
          </label>
          <input
            id="register-name"
            className="theme-input"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="As per KYC"
            required
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="theme-label" htmlFor="register-email">
                Email
              </label>
              <input
                id="register-email"
                className="theme-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                style={{ marginBottom: 16 }}
              />
            </div>
            <div>
              <label className="theme-label" htmlFor="register-phone">
                Phone
              </label>
              <input
                id="register-phone"
                className="theme-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919999999999"
                autoComplete="tel"
                required
                style={{ marginBottom: 16 }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="theme-label" htmlFor="register-password">
                Password
              </label>
              <input
                id="register-password"
                className="theme-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, letters + numbers"
                autoComplete="new-password"
                required
                style={{ marginBottom: 16 }}
              />
            </div>
            <div>
              <label className="theme-label" htmlFor="register-confirm">
                Confirm Password
              </label>
              <input
                id="register-confirm"
                className="theme-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
                style={{ marginBottom: 16 }}
              />
            </div>
          </div>

          {role === "advisor" && (
            <div className="theme-panel-muted" style={{ marginBottom: 16 }}>
              <p style={{ margin: 0, marginBottom: 12, fontSize: 13, fontWeight: 500 }}>
                Professional Details
              </p>

              <label className="theme-label" htmlFor="register-profession">
                Profession
              </label>
              <select
                id="register-profession"
                className="theme-input"
                value={professionalType}
                onChange={(e) => setProfessionalType(e.target.value as ProfessionalType)}
                style={{ marginBottom: 16 }}
              >
                {PROFESSIONAL_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              <label className="theme-label" htmlFor="register-sebi">
                {REG_FIELD[professionalType].label}
              </label>
              <input
                id="register-sebi"
                className="theme-input"
                type="text"
                value={sebi}
                onChange={(e) => setSebi(e.target.value.toUpperCase())}
                placeholder={REG_FIELD[professionalType].placeholder}
                required
                style={{ marginBottom: 16 }}
              />

              <label className="theme-label" htmlFor="register-exp">
                Years of Experience
              </label>
              <input
                id="register-exp"
                className="theme-input"
                type="number"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="e.g. 5"
                min={0}
                max={60}
                style={{ marginBottom: 16 }}
              />

              <label className="theme-label" htmlFor="register-bio">
                Short Bio (optional)
              </label>
              <textarea
                id="register-bio"
                className="theme-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Your advisory focus, strategy, credentials..."
                rows={3}
                style={{ marginBottom: 12, resize: "vertical" }}
              />

              <p className="theme-muted" style={{ margin: 0, fontSize: 12 }}>
                Your account will be created as <strong>Pending Verification</strong>. An admin will
                review your SEBI registration before your advisor capabilities are enabled.
              </p>
            </div>
          )}

          {error && <div className="theme-error">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="theme-btn-primary"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              fontSize: 16,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="theme-auth-muted" style={{ marginTop: 24, textAlign: "center", fontSize: 14 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
