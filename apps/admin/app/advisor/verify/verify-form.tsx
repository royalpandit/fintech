"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export default function AdvisorVerifyForm({ initialSebi }: { initialSebi: string }) {
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
      setError("Please fill your legal name, SEBI registration number, and PAN.");
      return;
    }
    if (!confirmed) {
      setError("Please confirm the declaration to continue.");
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
        <label style={labelStyle}>Full legal name (as per SEBI records)</label>
        <input style={fieldStyle} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Ananya Mehta" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>SEBI registration no.</label>
          <input style={fieldStyle} value={sebiRegistrationNo} onChange={(e) => setSebi(e.target.value)} placeholder="INA000000000" />
        </div>
        <div>
          <label style={labelStyle}>PAN</label>
          <input style={fieldStyle} value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" maxLength={10} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Firm / entity name (optional)</label>
          <input style={fieldStyle} value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="e.g. Mehta Capital Advisors" />
        </div>
        <div>
          <label style={labelStyle}>Registration valid till (optional)</label>
          <input style={fieldStyle} type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
        </div>
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--text)", lineHeight: 1.5, cursor: "pointer" }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          I confirm that I am a SEBI-registered investment adviser / government-approved
          advisor and that the details above are true and accurate.
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
