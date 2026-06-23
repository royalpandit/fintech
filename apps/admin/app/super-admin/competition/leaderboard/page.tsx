"use client";

import { FormEvent, useEffect, useState } from "react";
import { Btn, Field, Panel, competitionApi, tableStyle, tdStyle, thStyle, inputStyle } from "@/components/competition/admin-ui";

type Competition = { id: number; title: string };
type Entry = {
  id: number;
  userId: number;
  userName: string;
  portfolioValue: number | null;
  totalReturn: number | null;
  rank: number | null;
  updatedAt: string;
};

export default function LeaderboardAdminPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "points" | "score">("rank");
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [editScore, setEditScore] = useState("");

  useEffect(() => {
    competitionApi("/api/v1/admin/competitions").then(async (r) => {
      const j = await r.json();
      if (j.ok) {
        setCompetitions(j.data);
        if (j.data[0]) setCompetitionId(String(j.data[0].id));
      }
    });
  }, []);

  async function load() {
    if (!competitionId) return;
    setLoading(true);
    const r = await competitionApi(
      `/api/v1/admin/competitions/leaderboard?competition_id=${competitionId}&sort_by=${sortBy}`,
    );
    const j = await r.json();
    if (j.ok) setRows(j.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [competitionId, sortBy]);

  async function recalculate() {
    await competitionApi("/api/v1/admin/competitions/leaderboard", {
      method: "POST",
      body: JSON.stringify({ action: "recalculate", competitionId: Number(competitionId) }),
    });
    load();
  }

  async function updateEntry(e: FormEvent) {
    e.preventDefault();
    await competitionApi("/api/v1/admin/competitions/leaderboard", {
      method: "POST",
      body: JSON.stringify({
        competitionId: Number(competitionId),
        userId: Number(editUserId),
        points: Number(editPoints),
        score: Number(editScore),
      }),
    });
    setEditUserId("");
    setEditPoints("");
    setEditScore("");
    load();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="Leaderboard">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <Field label="Competition">
            <select style={inputStyle} value={competitionId} onChange={(e) => setCompetitionId(e.target.value)}>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Sort By">
            <select
              style={inputStyle}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "rank" | "points" | "score")}
            >
              <option value="rank">Rank</option>
              <option value="points">Points</option>
              <option value="score">Score</option>
            </select>
          </Field>
          <div style={{ alignSelf: "end" }}>
            <Btn onClick={recalculate}>Recalculate Ranks</Btn>
          </div>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Rank", "User", "Portfolio Value", "Return %", "Updated Time"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.rank ?? "—"}</td>
                  <td style={tdStyle}>{row.userName}</td>
                  <td style={tdStyle}>
                    {row.portfolioValue != null ? `₹${row.portfolioValue.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td style={tdStyle}>
                    {row.totalReturn != null ? `${row.totalReturn.toFixed(2)}%` : "—"}
                  </td>
                  <td style={tdStyle}>{new Date(row.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Update Score">
        <form onSubmit={updateEntry} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", alignItems: "end" }}>
          <Field label="User ID">
            <input style={inputStyle} value={editUserId} onChange={(e) => setEditUserId(e.target.value)} required />
          </Field>
          <Field label="Points">
            <input style={inputStyle} type="number" value={editPoints} onChange={(e) => setEditPoints(e.target.value)} />
          </Field>
          <Field label="Score">
            <input style={inputStyle} type="number" value={editScore} onChange={(e) => setEditScore(e.target.value)} />
          </Field>
          <Btn type="submit">Update</Btn>
        </form>
      </Panel>
    </div>
  );
}
