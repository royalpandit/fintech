"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { UserPageBackLink, UserPageSection } from "@/components/user/user-page-layout";

type Entry = {
  rank: number | null;
  userName: string;
  profileImage: string | null;
  reputationPoints: number;
  points: number;
};

export default function UserCompetitionLeaderboardClient() {
  const params = useParams();
  const id = params.id as string;
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/competitions/${id}/leaderboard`).then(async (r) => {
      const j = await r.json();
      if (j.ok) {
        setRows(j.data);
        setTitle(j.meta?.title ?? "Leaderboard");
      }
      setLoading(false);
    });
  }, [id]);

  function initials(name: string) {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <UserPageSection>
      <UserPageBackLink href={`/user/competition/${id}`}>← Back to Competition</UserPageBackLink>
      <h1 className="competition-detail-title" style={{ marginTop: 16 }}>
        {title} — Leaderboard
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
        Ranked by reputation points earned in this competition.
      </p>

      {loading ? (
        <p>Loading leaderboard…</p>
      ) : rows.length === 0 ? (
        <p className="competition-empty">No results yet. Leaderboard updates after results are declared.</p>
      ) : (
        <div className="competition-leaderboard" style={{ marginTop: 16 }}>
          <div
            className="competition-lb-row"
            style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)" }}
          >
            <div className="competition-lb-rank">Rank</div>
            <div className="competition-lb-user">User</div>
            <div className="competition-lb-stat">Reputation Points</div>
          </div>
          {rows.map((row) => {
            const rank = row.rank ?? 0;
            const badge = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
            return (
              <div
                key={`${row.userName}-${rank}`}
                className={`competition-lb-row${rank <= 3 ? " competition-lb-row--top" : ""}`}
              >
                <div className="competition-lb-rank">{badge ?? rank}</div>
                <div className="competition-lb-user">
                  {row.profileImage ? (
                    <img src={row.profileImage} alt="" className="competition-lb-avatar" />
                  ) : (
                    <span className="competition-lb-avatar competition-lb-avatar--initials">
                      {initials(row.userName)}
                    </span>
                  )}
                  <span>{row.userName}</span>
                </div>
                <div className="competition-lb-stat">
                  <span>{row.reputationPoints ?? row.points ?? 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </UserPageSection>
  );
}
