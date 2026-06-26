"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  COMPETITION_ROLE_KEYS,
  COMPETITION_ROLE_LABELS,
  COMPETITION_TAGS,
  COMPETITION_VISIBILITY_LABELS,
  COMPETITION_VISIBILITIES,
  type CompetitionRoleKey,
  type CompetitionVisibility,
} from "@/lib/competition";
import { Btn, Field, Panel, competitionApi, inputStyle } from "@/components/competition/admin-ui";

type Props = {
  competitionId?: string;
  viewOnly?: boolean;
};

export default function CompetitionFormPage({ competitionId, viewOnly = false }: Props) {
  const router = useRouter();
  const isEdit = Boolean(competitionId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [participationStart, setParticipationStart] = useState("");
  const [participationEnd, setParticipationEnd] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visibility, setVisibility] = useState<CompetitionVisibility>("public");
  const [status, setStatus] = useState("draft");
  const [reputationPoints, setReputationPoints] = useState("10");
  const [wrongPredictionPoints, setWrongPredictionPoints] = useState("0");
  const [maxPredictionsPerUser, setMaxPredictionsPerUser] = useState("1");
  const [allowPredictionChange, setAllowPredictionChange] = useState(false);
  const [requireLogin, setRequireLogin] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState("");
  const [roles, setRoles] = useState<CompetitionRoleKey[]>(["user"]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!competitionId) return;
    async function load() {
      const r = await competitionApi(`/api/v1/admin/competitions/${competitionId}`);
      const j = await r.json();
      if (j.ok) {
        const c = j.data;
        setTitle(c.title);
        setDescription(c.description ?? "");
        setBannerImage(c.bannerImage ?? "");
        setTags(c.tags ?? []);
        setQuestion(c.question ?? "");
        setOptions(c.options?.length ? c.options.map((o: { label: string }) => o.label) : ["", ""]);
        setParticipationStart(c.participationStartDate?.slice(0, 16) ?? "");
        setParticipationEnd(c.participationEndDate?.slice(0, 16) ?? "");
        setStartDate(c.startDate?.slice(0, 16) ?? "");
        setEndDate(c.endDate?.slice(0, 16) ?? "");
        setVisibility(c.visibility);
        setStatus(c.status);
        setReputationPoints(String(c.reputationPoints ?? 10));
        setWrongPredictionPoints(String(c.wrongPredictionPoints ?? 0));
        setMaxPredictionsPerUser(String(c.maxPredictionsPerUser ?? 1));
        setAllowPredictionChange(Boolean(c.allowPredictionChange));
        setRequireLogin(c.requireLogin !== false);
        setMaxParticipants(c.maxParticipants != null ? String(c.maxParticipants) : "");
        setRoles(c.allowedRoles?.map((r: { roleKey: CompetitionRoleKey }) => r.roleKey) ?? ["user"]);
      }
      setLoading(false);
    }
    load();
  }, [competitionId]);

  function toggleRole(key: CompetitionRoleKey) {
    if (viewOnly) return;
    if (key === "all") {
      setRoles(["all"]);
      return;
    }
    setRoles((prev) => {
      const withoutAll = prev.filter((r) => r !== "all");
      if (withoutAll.includes(key)) {
        const next = withoutAll.filter((r) => r !== key);
        return next.length ? next : ["user"];
      }
      return [...withoutAll, key];
    });
  }

  function toggleTag(tag: string) {
    if (viewOnly) return;
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (viewOnly) return;
    setSaving(true);
    setError("");

    const payload = {
      title,
      description,
      bannerImage,
      tags,
      question,
      options: options.map((label) => label.trim()).filter(Boolean),
      participationStartDate: new Date(participationStart).toISOString(),
      participationEndDate: new Date(participationEnd).toISOString(),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      visibility,
      status,
      reputationPoints: Number(reputationPoints) || 10,
      wrongPredictionPoints: Number(wrongPredictionPoints) || 0,
      maxPredictionsPerUser: Number(maxPredictionsPerUser) || 1,
      allowPredictionChange,
      requireLogin,
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      allowedRoles: roles,
    };

    const r = await competitionApi(
      isEdit ? `/api/v1/admin/competitions/${competitionId}` : "/api/v1/admin/competitions",
      { method: isEdit ? "PUT" : "POST", body: JSON.stringify(payload) },
    );
    const j = await r.json();
    setSaving(false);
    if (!j.ok) {
      setError(j.error || "Failed to save");
      return;
    }
    router.push("/super-admin/competition/list");
  }

  if (loading) return <p>Loading…</p>;

  const disabled = viewOnly;

  return (
    <Panel title={isEdit ? (viewOnly ? "View Competition" : "Edit Competition") : "Create Prediction Competition"}>
      <form onSubmit={onSubmit}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>Section 1 — Basic Information</h3>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <Field label="Competition Name *">
            <input style={inputStyle} disabled={disabled} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Status">
            <select style={inputStyle} disabled={disabled} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="upcoming">Upcoming</option>
              <option value="live">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Visibility">
            <select
              style={inputStyle}
              disabled={disabled}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as CompetitionVisibility)}
            >
              {COMPETITION_VISIBILITIES.filter((v) => v !== "hidden").map((v) => (
                <option key={v} value={v}>
                  {COMPETITION_VISIBILITY_LABELS[v]}
                </option>
              ))}
              <option value="hidden">Hidden</option>
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 12 }}>
          <Field label="Description">
            <textarea
              style={{ ...inputStyle, minHeight: 80 }}
              disabled={disabled}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Banner Image URL">
            <input
              style={inputStyle}
              disabled={disabled}
              value={bannerImage}
              onChange={(e) => setBannerImage(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Tags
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {COMPETITION_TAGS.map((tag) => (
              <label key={tag} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={tags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        <h3 style={{ margin: "24px 0 12px", fontSize: 14, fontWeight: 800 }}>Section 2 — Participation Window</h3>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <Field label="Participation Starts At *">
            <input
              style={inputStyle}
              disabled={disabled}
              type="datetime-local"
              value={participationStart}
              onChange={(e) => setParticipationStart(e.target.value)}
            />
          </Field>
          <Field label="Participation Ends At *">
            <input
              style={inputStyle}
              disabled={disabled}
              type="datetime-local"
              value={participationEnd}
              onChange={(e) => setParticipationEnd(e.target.value)}
            />
          </Field>
        </div>

        <h3 style={{ margin: "24px 0 12px", fontSize: 14, fontWeight: 800 }}>Section 3 — Competition Timeline</h3>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <Field label="Competition Starts At *">
            <input
              style={inputStyle}
              disabled={disabled}
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Competition Ends At *">
            <input
              style={inputStyle}
              disabled={disabled}
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>

        <h3 style={{ margin: "24px 0 12px", fontSize: 14, fontWeight: 800 }}>Section 4 & 5 — Question & Answer Options</h3>
        <Field label="Prediction Question *">
          <textarea
            style={{ ...inputStyle, minHeight: 72 }}
            disabled={disabled}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Which sector will perform best this week?"
          />
        </Field>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Answer Options * (min 2)</span>
            {!disabled ? (
              <Btn type="button" variant="ghost" onClick={() => setOptions((o) => [...o, ""])}>
                + Add Option
              </Btn>
            ) : null}
          </div>
          {options.map((opt, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                disabled={disabled}
                value={opt}
                onChange={(e) =>
                  setOptions((rows) => rows.map((r, j) => (j === i ? e.target.value : r)))
                }
                placeholder={`Option ${i + 1}`}
              />
              {!disabled && options.length > 2 ? (
                <Btn
                  type="button"
                  variant="danger"
                  onClick={() => setOptions((rows) => rows.filter((_, j) => j !== i))}
                >
                  Remove
                </Btn>
              ) : null}
            </div>
          ))}
        </div>

        <h3 style={{ margin: "24px 0 12px", fontSize: 14, fontWeight: 800 }}>Section 6 — Scoring Rules</h3>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Field label="Reputation Points (Correct)">
            <input
              style={inputStyle}
              disabled={disabled}
              type="number"
              value={reputationPoints}
              onChange={(e) => setReputationPoints(e.target.value)}
            />
          </Field>
          <Field label="Points (Wrong)">
            <input
              style={inputStyle}
              disabled={disabled}
              type="number"
              value={wrongPredictionPoints}
              onChange={(e) => setWrongPredictionPoints(e.target.value)}
            />
          </Field>
        </div>

        <h3 style={{ margin: "24px 0 12px", fontSize: 14, fontWeight: 800 }}>Section 7 — Participation Rules</h3>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Field label="Max Predictions Per User">
            <input
              style={inputStyle}
              disabled={disabled}
              type="number"
              min={1}
              value={maxPredictionsPerUser}
              onChange={(e) => setMaxPredictionsPerUser(e.target.value)}
            />
          </Field>
          <Field label="Maximum Participants">
            <input
              style={inputStyle}
              disabled={disabled}
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={allowPredictionChange}
              onChange={(e) => setAllowPredictionChange(e.target.checked)}
            />
            Allow prediction change before participation ends
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={requireLogin}
              onChange={(e) => setRequireLogin(e.target.checked)}
            />
            Require login
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Allowed Roles
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
            {COMPETITION_ROLE_KEYS.map((key) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={roles.includes(key)}
                  onChange={() => toggleRole(key)}
                />
                {COMPETITION_ROLE_LABELS[key]}
              </label>
            ))}
          </div>
        </div>

        {error ? <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{error}</p> : null}

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          {!viewOnly ? (
            <Btn type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Competition"}
            </Btn>
          ) : null}
          <Link href="/super-admin/competition/list">
            <Btn type="button" variant="ghost">
              {viewOnly ? "Back" : "Cancel"}
            </Btn>
          </Link>
        </div>
      </form>
    </Panel>
  );
}
