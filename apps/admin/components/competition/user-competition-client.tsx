"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CompetitionCard, { type CompetitionCardData } from "@/components/competition/competition-card";
import type { CompetitionUserTab } from "@/lib/competition";
import { UserPageHeader, UserPageSection } from "@/components/user/user-page-layout";
import Link from "next/link";

const TABS: { id: CompetitionUserTab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "my", label: "My Competitions" },
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
  const [joiningId, setJoiningId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const endpoint = tab === "my" ? `/api/v1/my-competitions?tab=${tab}` : `/api/v1/competitions?tab=${tab}`;
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

  async function handleJoin(id: number) {
    setJoiningId(id);
    const t = getToken();
    const r = await fetch(`/api/v1/competitions/${id}/join`, {
      method: "POST",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    const j = await r.json();
    setJoiningId(null);
    if (j.ok) window.location.href = `/user/competition/${id}/trade`;
    else alert(j.error || "Failed to join");
  }

  return (
    <UserPageSection>
      <UserPageHeader
        title="Competition"
        subtitle="Join trading competitions, climb the leaderboard, and win prizes."
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
              onJoin={tab !== "completed" ? handleJoin : undefined}
              joining={joiningId === c.id}
            />
          ))}
        </div>
      )}
    </UserPageSection>
  );
}
