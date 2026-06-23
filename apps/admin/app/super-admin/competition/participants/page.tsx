"use client";

import { useEffect, useState } from "react";
import { Btn, Field, Panel, competitionApi, tableStyle, tdStyle, thStyle, inputStyle } from "@/components/competition/admin-ui";

type Competition = { id: number; title: string };
type Participant = {
  id: number;
  userName: string;
  roleLabel: string;
  email: string;
  joinedAt: string;
  status: string;
  competitionTitle: string;
};

export default function ParticipantsAdminPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Participant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    competitionApi("/api/v1/admin/competitions").then(async (r) => {
      const j = await r.json();
      if (j.ok) setCompetitions(j.data);
    });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page) });
      if (competitionId) params.set("competition_id", competitionId);
      if (search) params.set("search", search);
      const r = await competitionApi(`/api/v1/admin/competitions/participants?${params}`);
      const j = await r.json();
      if (j.ok) {
        setRows(j.data);
        setTotal(j.meta?.total ?? 0);
      }
      setLoading(false);
    }
    load();
  }, [competitionId, search, page]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <Panel title="Participants">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <Field label="Competition">
          <select style={inputStyle} value={competitionId} onChange={(e) => { setCompetitionId(e.target.value); setPage(1); }}>
            <option value="">All Competitions</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </Field>
        <Field label="Search">
          <input
            style={inputStyle}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name or email"
          />
        </Field>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["User Name", "Role", "Email", "Competition", "Joined Date", "Status"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.userName}</td>
                  <td style={tdStyle}>{row.roleLabel}</td>
                  <td style={tdStyle}>{row.email}</td>
                  <td style={tdStyle}>{row.competitionTitle}</td>
                  <td style={tdStyle}>{new Date(row.joinedAt).toLocaleString()}</td>
                  <td style={tdStyle}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <Btn variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Btn>
            <span style={{ fontSize: 12 }}>Page {page} of {totalPages} ({total} total)</span>
            <Btn variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
          </div>
        </>
      )}
    </Panel>
  );
}
