"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  registrationCaption,
  validateProfessionalCredentials,
  type ProfessionalDetails,
  type ProfessionalType,
} from "@/lib/professional-types";

const fieldStyle = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box" as const,
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
};

export default function AdvisorVerifyForm({
  initialSebi,
  professionalType,
  initialDetails,
}: {
  initialSebi: string;
  professionalType: ProfessionalType;
  initialDetails: ProfessionalDetails;
}) {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [sebiRegistrationNo, setSebi] = useState(initialSebi);
  const [pan, setPan] = useState("");
  const [firmName, setFirmName] = useState("");
  const [validTill, setValidTill] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!legalName.trim() || !sebiRegistrationNo.trim() || !pan.trim()) {
      setError("Please fill your legal name, registration identifier, and PAN.");
      return;
    }
    if (!confirmed) {
      setError("Please confirm the declaration to continue.");
      return;
    }
    const credentialError = validateProfessionalCredentials(
      professionalType,
      sebiRegistrationNo,
      initialDetails,
    );
    if (credentialError) {
      setError(credentialError);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/advisor/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: legalName.trim(),
          sebiRegistrationNo: sebiRegistrationNo.trim().toUpperCase(),
          pan: pan.trim().toUpperCase(),
          firmName: firmName.trim() || null,
          validTill: validTill || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not submit verification. Please try again.");
        setLoading(false);
        return;
      }
      router.push("/advisor/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <label style={labelStyle}>Full legal name (as per registration records)</label>
        <input style={fieldStyle} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Ananya Mehta" />
      </div>

      {professionalType !== "finance_creator" && (
        <div>
          <label style={labelStyle}>{registrationCaption(professionalType, initialDetails)}</label>
          <input style={fieldStyle} value={sebiRegistrationNo} readOnly />
        </div>
      )}

      {Object.entries(initialDetails).map(([key, value]) => (
        <div key={key}>
          <label style={labelStyle}>
            {key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
          </label>
          <input style={fieldStyle} value={value} readOnly />
        </div>
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>PAN</label>
          <input style={fieldStyle} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
        </div>
        <div>
          <label style={labelStyle}>Registration valid till (optional)</label>
          <input style={fieldStyle} type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Additional firm / entity name (optional)</label>
        <input style={fieldStyle} value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="e.g. Mehta Capital Advisors" />
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--text)", lineHeight: 1.5, cursor: "pointer" }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          I confirm that I represent the professional / entity selected above and that the registration
          and identity details are true and accurate. I understand the application remains subject to manual review.
        </span>
      </label>

      {error && (
        <div style={{ fontSize: 13, color: "var(--brand-danger)", background: "rgba(239,68,68,0.12)", borderRadius: 8, padding: "10px 12px" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "12px 16px",
          borderRadius: 10,
          border: "none",
          background: "linear-gradient(90deg, var(--brand-primary), var(--brand-accent))",
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Submitting…" : "Submit verification"}
      </button>
    </form>
  );
}
