"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Btn, Panel, competitionApi, tableStyle, tdStyle, thStyle } from "@/components/competition/admin-ui";

type Row = {
  id: number;
  title: string;
  reputationPoints: number;
  participantCount: number;
  participationEndDate: string;
  endDate: string;
  status: string;
  effectiveStatus: string;
  visibility: string;
  resultDeclaredAt?: string | null;
};

export default function CompetitionListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const r = await competitionApi("/api/v1/admin/competitions");
    const text = await r.text();
    let j: { ok?: boolean; data?: Row[]; error?: string } = {};
    try {
      j = text ? JSON.parse(text) : {};
    } catch {
      setError("Server returned an invalid response. Try refreshing the page.");
      setLoading(false);
      return;
    }
    if (j.ok) setRows(j.data ?? []);
    else setError(j.error || `Failed to load (${r.status})`);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(id: number, action: "activate" | "deactivate") {
    await competitionApi(`/api/v1/admin/competitions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this competition?")) return;
    await competitionApi(`/api/v1/admin/competitions/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Link href="/super-admin/competition/create">
          <Btn>+ Create Competition</Btn>
        </Link>
      </div>
      <Panel title="Competition List">
        {error ? <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p> : null}
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {[
                  "Competition Name",
                  "Reputation Pts",
                  "Participants",
                  "Participation Ends",
                  "Competition Ends",
                  "Status",
                  "Visibility",
                  "Actions",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.title}</td>
                  <td style={tdStyle}>+{row.reputationPoints}</td>
                  <td style={tdStyle}>{row.participantCount}</td>
                  <td style={tdStyle}>{new Date(row.participationEndDate).toLocaleDateString()}</td>
                  <td style={tdStyle}>{new Date(row.endDate).toLocaleDateString()}</td>
                  <td style={tdStyle}>{row.effectiveStatus || row.status}</td>
                  <td style={tdStyle}>{row.visibility}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <Link href={`/super-admin/competition/${row.id}`}>
                        <Btn variant="ghost">View</Btn>
                      </Link>
                      <Link href={`/super-admin/competition/${row.id}/edit`}>
                        <Btn variant="ghost">Edit</Btn>
                      </Link>
                      {!row.resultDeclaredAt ? (
                        <Link href={`/super-admin/competition/${row.id}/declare`}>
                          <Btn variant="ghost">Declare Winner</Btn>
                        </Link>
                      ) : null}
                      {row.visibility === "public" ? (
                        <Btn variant="ghost" onClick={() => toggle(row.id, "deactivate")}>
                          Deactivate
                        </Btn>
                      ) : (
                        <Btn variant="ghost" onClick={() => toggle(row.id, "activate")}>
                          Activate
                        </Btn>
                      )}
                      <Btn variant="danger" onClick={() => remove(row.id)}>
                        Delete
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
