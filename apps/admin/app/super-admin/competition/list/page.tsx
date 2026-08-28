"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Btn, Panel, competitionApi, tableStyle, tdStyle, thStyle } from "@/components/competition/admin-ui";
import { LoadingRows } from "@/components/loading-shimmer";

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
  participationStartDate?: string | null;
  startDate?: string | null;
};

/** Plain-words reason a row won't appear on the public "Live" tab. */
function liveVisibilityIssue(row: Row): string | null {
  const now = Date.now();
  if (row.status === "draft") return "Draft — not published";
  if (row.status === "cancelled") return "Cancelled";
  if (row.visibility === "hidden") return "Hidden — users can't see this";
  if (row.resultDeclaredAt) return "Result declared — under Completed";
  if (row.endDate && new Date(row.endDate).getTime() < now)
    return "Ended — under Completed";
  const opensAt = row.participationStartDate ?? row.startDate;
  if (opensAt && new Date(opensAt).getTime() > now) return "Starts later — under Upcoming";
  return null;
}

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
          <LoadingRows />
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
                  <td style={tdStyle}>
                    {row.effectiveStatus || row.status}
                    {(() => {
                      const issue = liveVisibilityIssue(row);
                      return issue ? (
                        <span className="comp-not-live" title={issue}>
                          Not on Live · {issue}
                        </span>
                      ) : (
                        <span className="comp-is-live">Visible on Live</span>
                      );
                    })()}
                  </td>
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
