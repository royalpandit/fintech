"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Btn, Panel, competitionApi, tableStyle, tdStyle, thStyle } from "@/components/competition/admin-ui";

type Row = {
  id: number;
  title: string;
  entryType: string;
  prizePool: number | null;
  participantCount: number;
  startDate: string;
  endDate: string;
  status: string;
  visibility: string;
};

export default function CompetitionListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await competitionApi("/api/v1/admin/competitions");
    const j = await r.json();
    if (j.ok) setRows(j.data);
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
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {[
                  "Competition Name",
                  "Entry Type",
                  "Prize Pool",
                  "Participants",
                  "Start Date",
                  "End Date",
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
                  <td style={tdStyle}>{row.entryType}</td>
                  <td style={tdStyle}>
                    {row.prizePool != null ? `₹${row.prizePool.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td style={tdStyle}>{row.participantCount}</td>
                  <td style={tdStyle}>{new Date(row.startDate).toLocaleDateString()}</td>
                  <td style={tdStyle}>{new Date(row.endDate).toLocaleDateString()}</td>
                  <td style={tdStyle}>{row.status}</td>
                  <td style={tdStyle}>{row.visibility}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <Link href={`/super-admin/competition/${row.id}`}>
                        <Btn variant="ghost">View</Btn>
                      </Link>
                      <Link href={`/super-admin/competition/${row.id}/edit`}>
                        <Btn variant="ghost">Edit</Btn>
                      </Link>
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
