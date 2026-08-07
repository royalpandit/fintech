"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordField from "@/components/auth/password-field";
import AltLoginMethods from "@/components/auth/alt-login-methods";
import AuthSplitLayout from "@/components/auth/auth-split-layout";
import { PROFESSIONAL_TYPES, type ProfessionalType } from "@/lib/professional-types";
import { normalizeIndianMobile } from "@/lib/phone";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = "user" | "advisor";

// Group 1 — regulated professionals/entities: a registration number is MANDATORY.
// The placeholder hints the expected format per profession.
const GROUP1_PLACEHOLDER: Partial<Record<ProfessionalType, string>> = {
  research_analyst: "INH000001234",
  investment_advisor: "INA000012345",
  portfolio_manager: "INP000001234",
  advisory_firm: "INH… / INA…",
  mutual_fund_distributor: "ARN-123456",
};
const GROUP1 = new Set<ProfessionalType>([
  "research_analyst",
  "investment_advisor",
  "portfolio_manager",
  "advisory_firm",
  "mutual_fund_distributor",
]);

// Group 2 — no individual registration number; ask for identifying details instead.
type AltField = { key: string; label: string; placeholder: string; optional?: boolean };
const GROUP2_FIELDS: Partial<Record<ProfessionalType, AltField[]>> = {
  wealth_manager: [{ key: "companyName", label: "Company Name", placeholder: "Your firm / company" }],
  stock_broker: [
    { key: "brokerName", label: "Broker Name", placeholder: "e.g. Zerodha, Angel One" },
    { key: "employeeId", label: "Employee ID (optional)", placeholder: "Optional", optional: true },
  ],
  finance_creator: [{ key: "socialHandle", label: "Social Media Handle", placeholder: "@yourhandle or channel link" }],
  listed_company: [
    { key: "companyName", label: "Company Name", placeholder: "Registered company name" },
    { key: "symbol", label: "NSE / BSE Symbol", placeholder: "e.g. ZENITH" },
  ],
  financial_platform: [{ key: "platformName", label: "Platform Name", placeholder: "Your platform / product name" }],
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
  const [details, setDetails] = useState<Record<string, string>>({});
  const [experienceYears, setExperienceYears] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isGroup1 = GROUP1.has(professionalType);
  const altFields = GROUP2_FIELDS[professionalType] ?? [];
  const setDetail = (k: string, v: string) => setDetails((d) => ({ ...d, [k]: v }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (fullName.trim().length < 2) {
      setError("Please enter your full name");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    const mobile = normalizeIndianMobile(phone);
    if (!mobile) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must include both letters and numbers");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
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
          phone: mobile,
          password,
          role,
          ...(role === "advisor"
            ? {
                professionalType,
                ...(isGroup1
                  ? { sebiRegistrationNo: sebi.trim().toUpperCase() }
                  : { details }),
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
    <AuthSplitLayout variant="sign-up" wide>
      <h1 style={{ margin: 0, marginBottom: 8, fontSize: 26 }}>Create your account</h1>
      <p className="theme-auth-muted" style={{ margin: 0, marginBottom: 24, fontSize: 14 }}>
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
              <div style={{ position: "relative", marginBottom: 16 }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 15,
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  +91
                  <span style={{ width: 1, height: 18, background: "var(--border)" }} />
                </span>
                <input
                  id="register-phone"
                  className="theme-input"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile"
                  autoComplete="tel"
                  maxLength={10}
                  required
                  style={{ marginBottom: 0, paddingLeft: 62 }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <PasswordField
                id="register-password"
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="Min 8 chars, letters + numbers"
                autoComplete="new-password"
                marginBottom={16}
              />
            </div>
            <div>
              <PasswordField
                id="register-confirm"
                label="Confirm Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter password"
                autoComplete="new-password"
                marginBottom={16}
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

              {isGroup1 ? (
                <>
                  <label className="theme-label" htmlFor="register-reg">
                    Registration No.
                  </label>
                  <input
                    id="register-reg"
                    className="theme-input"
                    type="text"
                    value={sebi}
                    onChange={(e) => setSebi(e.target.value.toUpperCase())}
                    placeholder={GROUP1_PLACEHOLDER[professionalType] ?? "Registration number"}
                    required
                    style={{ marginBottom: 16 }}
                  />
                </>
              ) : (
                altFields.map((f) => (
                  <div key={f.key}>
                    <label className="theme-label" htmlFor={`register-${f.key}`}>
                      {f.label}
                    </label>
                    <input
                      id={`register-${f.key}`}
                      className="theme-input"
                      type="text"
                      value={details[f.key] ?? ""}
                      onChange={(e) => setDetail(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      required={!f.optional}
                      style={{ marginBottom: 16 }}
                    />
                  </div>
                ))
              )}

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
                placeholder="Your focus, strategy, credentials..."
                rows={3}
                style={{ marginBottom: 12, resize: "vertical" }}
              />

              <p className="theme-muted" style={{ margin: 0, fontSize: 12 }}>
                Your account will be created as <strong>Pending Verification</strong>. An admin will
                review your details before your professional capabilities are enabled.
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

      <AltLoginMethods mode="sign up" />
    </AuthSplitLayout>
  );
}
