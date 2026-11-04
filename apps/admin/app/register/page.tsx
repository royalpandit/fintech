"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordField from "@/components/auth/password-field";
import AltLoginMethods from "@/components/auth/alt-login-methods";
import AuthSplitLayout from "@/components/auth/auth-split-layout";
import {
  PROFESSIONAL_TYPES,
  REGULATED_REGISTRATION_TYPES,
  registrationFieldLabel,
  registrationFieldPlaceholder,
  validateProfessionalCredentials,
  type ProfessionalType,
} from "@/lib/professional-types";
import { normalizeIndianMobile } from "@/lib/phone";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = "user" | "advisor";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("user");
  const [professionalType, setProfessionalType] = useState<ProfessionalType>("investment_advisor");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [experienceYears, setExperienceYears] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (role === "advisor") {
      const credentialError = validateProfessionalCredentials(professionalType, registrationNo, details);
      if (credentialError) {
        setError(credentialError);
        return;
      }
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
                registrationNo: registrationNo.trim().toUpperCase(),
                details: Object.fromEntries(
                  Object.entries(details).map(([key, value]) => [key, value.trim()]),
                ),
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

              {(professionalType === "advisory_firm" ||
                professionalType === "wealth_manager" ||
                professionalType === "financial_platform" ||
                professionalType === "listed_company") && (
                <>
                  <label className="theme-label" htmlFor="register-entity-name">
                    Registered Company / Entity Name
                  </label>
                  <input
                    id="register-entity-name"
                    className="theme-input"
                    value={details.entityName ?? ""}
                    onChange={(e) => setDetail("entityName", e.target.value)}
                    required
                    style={{ marginBottom: 16 }}
                  />
                </>
              )}

              {(professionalType === "advisory_firm" || professionalType === "wealth_manager") && (
                <>
                  <label className="theme-label" htmlFor="register-regulatory-type">
                    Registration category
                  </label>
                  <select
                    id="register-regulatory-type"
                    className="theme-input"
                    value={details.regulatoryType ?? ""}
                    onChange={(e) => setDetail("regulatoryType", e.target.value)}
                    required
                    style={{ marginBottom: 16 }}
                  >
                    <option value="">Select registration category</option>
                    {REGULATED_REGISTRATION_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </>
              )}

              {professionalType !== "finance_creator" && (
                <>
                  <label className="theme-label" htmlFor="register-reg">
                    {registrationFieldLabel(professionalType, details)}
                  </label>
                  <input
                    id="register-reg"
                    className="theme-input"
                    type="text"
                    value={registrationNo}
                    onChange={(e) => setRegistrationNo(e.target.value.toUpperCase())}
                    placeholder={registrationFieldPlaceholder(professionalType, details)}
                    disabled={
                      (professionalType === "advisory_firm" || professionalType === "wealth_manager") &&
                      !details.regulatoryType
                    }
                    required
                    style={{ marginBottom: 16 }}
                  />
                </>
              )}

              {professionalType === "listed_company" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="theme-label" htmlFor="register-exchange">Exchange</label>
                    <select
                      id="register-exchange"
                      className="theme-input"
                      value={details.exchange ?? ""}
                      onChange={(e) => setDetail("exchange", e.target.value)}
                      required
                    >
                      <option value="">Select</option>
                      <option value="NSE">NSE</option>
                      <option value="BSE">BSE</option>
                    </select>
                  </div>
                  <div>
                    <label className="theme-label" htmlFor="register-ticker">Exchange ticker</label>
                    <input
                      id="register-ticker"
                      className="theme-input"
                      value={details.ticker ?? ""}
                      onChange={(e) => setDetail("ticker", e.target.value.toUpperCase())}
                      placeholder="e.g. INFY"
                      required
                    />
                  </div>
                </div>
              )}

              {professionalType === "finance_creator" && (
                <>
                  <label className="theme-label" htmlFor="register-instagram">Instagram profile URL</label>
                  <input
                    id="register-instagram"
                    className="theme-input"
                    type="url"
                    value={details.instagramUrl ?? ""}
                    onChange={(e) => setDetail("instagramUrl", e.target.value)}
                    placeholder="https://www.instagram.com/yourprofile"
                    required
                    style={{ marginBottom: 16 }}
                  />
                  <label className="theme-label" htmlFor="register-youtube">YouTube profile URL</label>
                  <input
                    id="register-youtube"
                    className="theme-input"
                    type="url"
                    value={details.youtubeUrl ?? ""}
                    onChange={(e) => setDetail("youtubeUrl", e.target.value)}
                    placeholder="https://www.youtube.com/@yourchannel"
                    required
                    style={{ marginBottom: 16 }}
                  />
                </>
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
                manually check your registration and details against official records before approving
                your profile. Matching the expected format alone does not verify a registration.
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
