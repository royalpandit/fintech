"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  COMPETITION_REWARD_LABELS,
  COMPETITION_REWARD_TYPES,
  type CompetitionRewardType,
} from "@/lib/competition";
import { Btn, Field, Panel, competitionApi, inputStyle } from "@/components/competition/admin-ui";

type Competition = { id: number; title: string };
type Prize = {
  fromRank: number;
  toRank: number;
  rewardType: CompetitionRewardType;
  rewardValue: string;
  rankLabel: string;
  displayValue: string;
};

export default function PrizeDistributionPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [fromRank, setFromRank] = useState("");
  const [toRank, setToRank] = useState("");
  const [rewardType, setRewardType] = useState<CompetitionRewardType>("cash");
  const [rewardValue, setRewardValue] = useState("");
  const [tiers, setTiers] = useState<
    { fromRank: string; toRank: string; rewardType: CompetitionRewardType; rewardValue: string }[]
  >([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    competitionApi("/api/v1/admin/competitions").then(async (r) => {
      const j = await r.json();
      if (j.ok) {
        setCompetitions(j.data);
        if (j.data[0]) setCompetitionId(String(j.data[0].id));
      }
    });
  }, []);

  useEffect(() => {
    if (!competitionId) return;
    competitionApi(`/api/v1/admin/competitions/${competitionId}/prizes`).then(async (r) => {
      const j = await r.json();
      if (j.ok) {
        setPrizes(j.data);
        setTiers(
          j.data.length
            ? j.data.map((p: Prize) => ({
                fromRank: String(p.fromRank),
                toRank: String(p.toRank),
                rewardType: p.rewardType,
                rewardValue: p.rewardValue,
              }))
            : [{ fromRank: "1", toRank: "1", rewardType: "cash", rewardValue: "" }],
        );
      }
    });
  }, [competitionId]);

  function addTier() {
    setTiers((t) => [...t, { fromRank: "", toRank: "", rewardType: "cash", rewardValue: "" }]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!competitionId) return;
    setSaving(true);
    const payload = tiers
      .filter((t) => t.fromRank && t.toRank && t.rewardValue)
      .map((t) => ({
        fromRank: Number(t.fromRank),
        toRank: Number(t.toRank),
        rewardType: t.rewardType,
        rewardValue: t.rewardValue,
      }));
    await competitionApi(`/api/v1/admin/competitions/${competitionId}/prizes`, {
      method: "PUT",
      body: JSON.stringify({ prizes: payload }),
    });
    setSaving(false);
    const r = await competitionApi(`/api/v1/admin/competitions/${competitionId}/prizes`);
    const j = await r.json();
    if (j.ok) setPrizes(j.data);
  }

  return (
    <Panel title="Prize Distribution">
      <Field label="Competition">
        <select style={{ ...inputStyle, maxWidth: 400, marginBottom: 16 }} value={competitionId} onChange={(e) => setCompetitionId(e.target.value)}>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </Field>

      {prizes.length > 0 ? (
        <div style={{ marginBottom: 20, padding: 12, background: "var(--bg)", borderRadius: 8 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Current prizes</p>
          {prizes.map((p, i) => (
            <p key={i} style={{ margin: "4px 0", fontSize: 13 }}>
              {p.rankLabel} = {p.displayValue} ({COMPETITION_REWARD_LABELS[p.rewardType]})
            </p>
          ))}
        </div>
      ) : null}

      <form onSubmit={onSubmit}>
        {tiers.map((t, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              marginBottom: 10,
              alignItems: "end",
            }}
          >
            <Field label="From Rank">
              <input
                style={inputStyle}
                type="number"
                value={t.fromRank}
                onChange={(e) =>
                  setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, fromRank: e.target.value } : r)))
                }
              />
            </Field>
            <Field label="To Rank">
              <input
                style={inputStyle}
                type="number"
                value={t.toRank}
                onChange={(e) =>
                  setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, toRank: e.target.value } : r)))
                }
              />
            </Field>
            <Field label="Reward Type">
              <select
                style={inputStyle}
                value={t.rewardType}
                onChange={(e) =>
                  setTiers((rows) =>
                    rows.map((r, j) =>
                      j === i ? { ...r, rewardType: e.target.value as CompetitionRewardType } : r,
                    ),
                  )
                }
              >
                {COMPETITION_REWARD_TYPES.map((rt) => (
                  <option key={rt} value={rt}>{COMPETITION_REWARD_LABELS[rt]}</option>
                ))}
              </select>
            </Field>
            <Field label="Reward Value">
              <input
                style={inputStyle}
                value={t.rewardValue}
                onChange={(e) =>
                  setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, rewardValue: e.target.value } : r)))
                }
                placeholder="50000"
              />
            </Field>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn type="button" variant="ghost" onClick={addTier}>+ Add Tier</Btn>
          <Btn type="submit" disabled={saving}>{saving ? "Saving…" : "Save Prizes"}</Btn>
        </div>
      </form>
    </Panel>
  );
}
