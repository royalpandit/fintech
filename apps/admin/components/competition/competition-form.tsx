"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  COMPETITION_REWARD_LABELS,
  COMPETITION_REWARD_TYPES,
  COMPETITION_ROLE_KEYS,
  COMPETITION_ROLE_LABELS,
  type CompetitionRewardType,
  type CompetitionRoleKey,
} from "@/lib/competition";
import { Btn, Field, Panel, competitionApi, inputStyle } from "@/components/competition/admin-ui";

type PrizeRow = {
  fromRank: string;
  toRank: string;
  rewardType: CompetitionRewardType;
  rewardValue: string;
};

const emptyPrize = (): PrizeRow => ({
  fromRank: "",
  toRank: "",
  rewardType: "cash",
  rewardValue: "",
});

type Props = {
  competitionId?: string;
  viewOnly?: boolean;
};

export default function CompetitionFormPage({ competitionId, viewOnly = false }: Props) {
  const router = useRouter();
  const isEdit = Boolean(competitionId);

  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [entryType, setEntryType] = useState<"free" | "paid">("free");
  const [entryFee, setEntryFee] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visibility, setVisibility] = useState<"public" | "hidden">("public");
  const [status, setStatus] = useState("upcoming");
  const [roles, setRoles] = useState<CompetitionRoleKey[]>(["user"]);
  const [prizes, setPrizes] = useState<PrizeRow[]>([emptyPrize()]);
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
        setShortDescription(c.shortDescription ?? "");
        setDescription(c.description ?? "");
        setBannerImage(c.bannerImage ?? "");
        setEntryType(c.entryType);
        setEntryFee(c.entryFee != null ? String(c.entryFee) : "");
        setPrizePool(c.prizePool != null ? String(c.prizePool) : "");
        setMaxParticipants(c.maxParticipants != null ? String(c.maxParticipants) : "");
        setStartDate(c.startDate?.slice(0, 16) ?? "");
        setEndDate(c.endDate?.slice(0, 16) ?? "");
        setVisibility(c.visibility);
        setStatus(c.status);
        setRoles(c.allowedRoles?.map((r: { roleKey: CompetitionRoleKey }) => r.roleKey) ?? ["user"]);
        setPrizes(
          c.prizes?.length
            ? c.prizes.map((p: PrizeRow & { fromRank: number; toRank: number }) => ({
                fromRank: String(p.fromRank),
                toRank: String(p.toRank),
                rewardType: p.rewardType,
                rewardValue: p.rewardValue,
              }))
            : [emptyPrize()],
        );
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (viewOnly) return;
    setSaving(true);
    setError("");

    const payload = {
      title,
      shortDescription,
      description,
      bannerImage,
      entryType,
      entryFee: entryType === "paid" ? Number(entryFee) : 0,
      prizePool: Number(prizePool) || 0,
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      visibility,
      status,
      allowedRoles: roles,
      prizes: prizes
        .filter((p) => p.fromRank && p.toRank && p.rewardValue)
        .map((p) => ({
          fromRank: Number(p.fromRank),
          toRank: Number(p.toRank),
          rewardType: p.rewardType,
          rewardValue: p.rewardValue,
        })),
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
    <Panel title={isEdit ? (viewOnly ? "View Competition" : "Edit Competition") : "Create Competition"}>
      <form onSubmit={onSubmit}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <Field label="Competition Name *">
            <input style={inputStyle} disabled={disabled} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Entry Type">
            <select
              style={inputStyle}
              disabled={disabled}
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as "free" | "paid")}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </Field>
          <Field label="Entry Fee">
            <input
              style={inputStyle}
              disabled={disabled || entryType === "free"}
              type="number"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
            />
          </Field>
          <Field label="Prize Pool (₹)">
            <input
              style={inputStyle}
              disabled={disabled}
              type="number"
              value={prizePool}
              onChange={(e) => setPrizePool(e.target.value)}
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
          <Field label="Start Date *">
            <input
              style={inputStyle}
              disabled={disabled}
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End Date *">
            <input
              style={inputStyle}
              disabled={disabled}
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
          <Field label="Visibility">
            <select
              style={inputStyle}
              disabled={disabled}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "hidden")}
            >
              <option value="public">Public</option>
              <option value="hidden">Hidden</option>
            </select>
          </Field>
          <Field label="Status">
            <select style={inputStyle} disabled={disabled} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>

        <div style={{ marginTop: 12 }}>
          <Field label="Short Description">
            <input
              style={inputStyle}
              disabled={disabled}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Description">
            <textarea
              style={{ ...inputStyle, minHeight: 100 }}
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

        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Prize Distribution</span>
            {!disabled ? (
              <Btn type="button" variant="ghost" onClick={() => setPrizes((p) => [...p, emptyPrize()])}>
                + Add Tier
              </Btn>
            ) : null}
          </div>
          {prizes.map((p, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                marginBottom: 8,
                alignItems: "end",
              }}
            >
              <Field label="From Rank">
                <input
                  style={inputStyle}
                  disabled={disabled}
                  type="number"
                  value={p.fromRank}
                  onChange={(e) =>
                    setPrizes((rows) => rows.map((r, j) => (j === i ? { ...r, fromRank: e.target.value } : r)))
                  }
                />
              </Field>
              <Field label="To Rank">
                <input
                  style={inputStyle}
                  disabled={disabled}
                  type="number"
                  value={p.toRank}
                  onChange={(e) =>
                    setPrizes((rows) => rows.map((r, j) => (j === i ? { ...r, toRank: e.target.value } : r)))
                  }
                />
              </Field>
              <Field label="Reward Type">
                <select
                  style={inputStyle}
                  disabled={disabled}
                  value={p.rewardType}
                  onChange={(e) =>
                    setPrizes((rows) =>
                      rows.map((r, j) =>
                        j === i ? { ...r, rewardType: e.target.value as CompetitionRewardType } : r,
                      ),
                    )
                  }
                >
                  {COMPETITION_REWARD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {COMPETITION_REWARD_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reward Value">
                <input
                  style={inputStyle}
                  disabled={disabled}
                  value={p.rewardValue}
                  onChange={(e) =>
                    setPrizes((rows) => rows.map((r, j) => (j === i ? { ...r, rewardValue: e.target.value } : r)))
                  }
                  placeholder="50000"
                />
              </Field>
            </div>
          ))}
        </div>

        {error ? <p style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{error}</p> : null}

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            position: "sticky",
            bottom: 0,
            background: "var(--surface)",
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
