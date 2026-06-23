"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatINR } from "@/lib/competition";
import { UserPageBackLink, UserPageSection } from "@/components/user/user-page-layout";

type Detail = {
  id: number;
  title: string;
  description?: string | null;
  bannerImage?: string | null;
  prizePool: number | null;
  entryType: string;
  entryFee: number | null;
  participantCount: number;
  startDate: string;
  endDate: string;
  effectiveStatus: string;
  joined: boolean;
  prizes: { rankLabel: string; displayValue: string; rewardTypeLabel: string }[];
  rules?: string;
};

function getToken() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
  return m ? m[1] : null;
}

export default function UserCompetitionDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/competitions/${id}`).then(async (r) => {
      const j = await r.json();
      if (j.ok) setData(j.data);
      setLoading(false);
    });
  }, [id]);

  async function join() {
    setJoining(true);
    const t = getToken();
    const r = await fetch(`/api/v1/competitions/${id}/join`, {
      method: "POST",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    const j = await r.json();
    setJoining(false);
    if (j.ok) {
      router.push(`/user/competition/${id}/trade`);
    } else {
      alert(j.error || "Failed to join");
    }
  }

  if (loading) {
    return (
      <UserPageSection>
        <p>Loading…</p>
      </UserPageSection>
    );
  }

  if (!data) {
    return (
      <UserPageSection>
        <UserPageBackLink href="/user/competition">← Back to Competition</UserPageBackLink>
        <p>Competition not found.</p>
      </UserPageSection>
    );
  }

  const canJoin =
    !data.joined && (data.effectiveStatus === "live" || data.effectiveStatus === "upcoming");

  return (
    <UserPageSection>
      <UserPageBackLink href="/user/competition">← Back to Competition</UserPageBackLink>

      <div
        className="competition-detail-banner"
        style={
          data.bannerImage
            ? { backgroundImage: `url(${data.bannerImage})` }
            : { background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)" }
        }
      />

      <div className="competition-detail-header">
        <h1 className="competition-detail-title">{data.title}</h1>
        <span className={`competition-card-status competition-card-status--${data.effectiveStatus}`}>
          {data.effectiveStatus}
        </span>
      </div>

      <div className="competition-detail-meta">
        <div><strong>Prize Pool:</strong> {formatINR(data.prizePool)}</div>
        <div>
          <strong>Entry:</strong> {data.entryType === "paid" ? formatINR(data.entryFee) : "Free"}
        </div>
        <div><strong>Participants:</strong> {data.participantCount}</div>
        <div><strong>Start:</strong> {new Date(data.startDate).toLocaleString()}</div>
        <div><strong>End:</strong> {new Date(data.endDate).toLocaleString()}</div>
      </div>

      {data.description ? (
        <section className="competition-detail-section">
          <h2>Description</h2>
          <p>{data.description}</p>
        </section>
      ) : null}

      {data.rules ? (
        <section className="competition-detail-section">
          <h2>Rules</h2>
          <p>{data.rules}</p>
        </section>
      ) : null}

      {data.prizes.length > 0 ? (
        <section className="competition-detail-section">
          <h2>Prize Distribution</h2>
          <ul className="competition-prize-list">
            {data.prizes.map((p, i) => (
              <li key={i}>
                <span>{p.rankLabel}</span>
                <span>{p.displayValue}</span>
                <span className="competition-prize-type">{p.rewardTypeLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="competition-detail-actions">
        {canJoin ? (
          <button type="button" className="competition-card-join-btn" disabled={joining} onClick={join}>
            {joining ? "Joining…" : "Join Competition"}
          </button>
        ) : data.joined ? (
          <Link href={`/user/competition/${id}/trade`} className="competition-card-join-btn">
            Open Competition
          </Link>
        ) : null}
        <Link href={`/user/competition/${id}/leaderboard`} className="competition-card-view-btn">
          View Leaderboard
        </Link>
      </div>
    </UserPageSection>
  );
}
