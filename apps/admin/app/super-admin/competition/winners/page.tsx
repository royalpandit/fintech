"use client";

import { useEffect, useState } from "react";
import { Btn, Field, Panel, competitionApi, tableStyle, tdStyle, thStyle, inputStyle } from "@/components/competition/admin-ui";

type Competition = { id: number; title: string };
type Winner = {
  id: number;
  rank: number;
  userName: string;
  rewardTypeLabel: string;
  displayValue: string;
  distributed: boolean;
  competitionTitle: string;
};

export default function WinnersAdminPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [rows, setRows] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    competitionApi("/api/v1/admin/competitions").then(async (r) => {
      const j = await r.json();
      if (j.ok) setCompetitions(j.data);
    });
  }, []);

  async function load() {
    setLoading(true);
    const params = competitionId ? `?competition_id=${competitionId}` : "";
    const r = await competitionApi(`/api/v1/admin/competitions/winners${params}`);
    const j = await r.json();
    if (j.ok) setRows(j.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [competitionId]);

  async function syncWinners() {
    if (!competitionId) return;
    await competitionApi("/api/v1/admin/competitions/winners", {
      method: "POST",
      body: JSON.stringify({ action: "sync", competitionId: Number(competitionId) }),
    });
    load();
  }

  async function toggleDistributed(winnerId: number, distributed: boolean) {
    await competitionApi("/api/v1/admin/competitions/winners", {
      method: "POST",
      body: JSON.stringify({ action: "mark_distributed", winnerId, distributed: !distributed }),
    });
    load();
  }

  return (
    <Panel title="Winners">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, alignItems: "end" }}>
        <Field label="Competition">
          <select style={inputStyle} value={competitionId} onChange={(e) => setCompetitionId(e.target.value)}>
            <option value="">All Competitions</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </Field>
        {competitionId ? <Btn onClick={syncWinners}>Sync from Leaderboard</Btn> : null}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Rank", "User Name", "Reward Type", "Reward Value", "Competition", "Distribution Status", "Actions"].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={tdStyle}>{row.rank}</td>
                <td style={tdStyle}>{row.userName}</td>
                <td style={tdStyle}>{row.rewardTypeLabel}</td>
                <td style={tdStyle}>{row.displayValue}</td>
                <td style={tdStyle}>{row.competitionTitle}</td>
                <td style={tdStyle}>{row.distributed ? "Distributed" : "Pending"}</td>
                <td style={tdStyle}>
                  <Btn variant="ghost" onClick={() => toggleDistributed(row.id, row.distributed)}>
                    {row.distributed ? "Mark Pending" : "Mark Distributed"}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
