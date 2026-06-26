"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CompetitionCard, { type CompetitionCardData } from "@/components/competition/competition-card";
import type { CompetitionUserTab } from "@/lib/competition";
import { UserPageHeader, UserPageSection } from "@/components/user/user-page-layout";

const TABS: { id: CompetitionUserTab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "my", label: "My Predictions" },
];

function getToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
  return m ? m[1] : null;
}

export default function UserCompetitionClient() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as CompetitionUserTab) || "live";

  const [competitions, setCompetitions] = useState<CompetitionCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const endpoint = `/api/v1/competitions?tab=${tab}`;
    const r = await fetch(endpoint, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    });
    const j = await r.json();
    if (j.ok) setCompetitions(j.data);
    else setCompetitions([]);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <UserPageSection>
      <UserPageHeader
        title="Competitions"
        subtitle="Predict market outcomes, earn reputation points, and climb the Finuer leaderboard."
      />

      <div className="competition-tabs">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/user/competition?tab=${t.id}`}
            className={`competition-tab${tab === t.id ? " competition-tab--active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <p className="competition-loading">Loading competitions…</p>
      ) : competitions.length === 0 ? (
        <p className="competition-empty">No competitions in this category.</p>
      ) : (
        <div className="competition-grid">
          {competitions.map((c) => (
            <CompetitionCard
              key={c.id}
              competition={c}
              onParticipate={(id) => {
                window.location.href = `/user/competition/${id}`;
              }}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/user/competition/my-predictions" className="competition-card-view-btn">
          View all my predictions →
        </Link>
      </div>
    </UserPageSection>
  );
}
