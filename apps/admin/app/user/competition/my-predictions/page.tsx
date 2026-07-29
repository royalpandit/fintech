"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserPageHeader, UserPageSection } from "@/components/user/user-page-layout";

type Row = {
  id: number;
  title: string;
  predictionStatus: string;
  predictionLabel: string;
  pointsEarned: number;
  effectiveStatus: string;
};

function getToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
  return m ? m[1] : null;
}

export default function MyPredictionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    fetch("/api/v1/my-predictions", {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    }).then(async (r) => {
      const j = await r.json();
      if (j.ok) setRows(j.data);
      setLoading(false);
    });
  }, []);

  return (
    <UserPageSection>
      <UserPageHeader
        title="My Predictions"
        subtitle="Every prediction you've made across Finuer competitions."
      />

      <div style={{ marginBottom: 16 }}>
        <Link href="/user/competition" className="competition-card-view-btn">
          ← Back to Competitions
        </Link>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="competition-empty">You haven&apos;t made any predictions yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "10px 8px" }}>Competition</th>
              <th style={{ padding: "10px 8px" }}>Status</th>
              <th style={{ padding: "10px 8px" }}>Prediction</th>
              <th style={{ padding: "10px 8px" }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 8px" }}>
                  <Link href={`/user/competition/${row.id}`} style={{ fontWeight: 600 }}>
                    {row.title}
                  </Link>
                </td>
                <td style={{ padding: "12px 8px" }}>{row.predictionStatus}</td>
                <td style={{ padding: "12px 8px" }}>{row.predictionLabel}</td>
                <td style={{ padding: "12px 8px" }}>
                  {row.predictionStatus === "Won" ? `+${row.pointsEarned}` : row.pointsEarned}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </UserPageSection>
  );
}
