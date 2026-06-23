"use client";

import Link from "next/link";
import { formatINR } from "@/lib/competition";

export type CompetitionCardData = {
  id: number;
  title: string;
  shortDescription?: string | null;
  bannerImage?: string | null;
  prizePool: number | null;
  entryType: string;
  entryFee: number | null;
  participantCount: number;
  daysLeft: number | null;
  effectiveStatus: string;
  joined?: boolean;
  startDate: string;
  endDate: string;
};

type Props = {
  competition: CompetitionCardData;
  onJoin?: (id: number) => void;
  joining?: boolean;
};

export default function CompetitionCard({ competition, onJoin, joining }: Props) {
  const c = competition;
  const canJoin =
    !c.joined &&
    (c.effectiveStatus === "live" || c.effectiveStatus === "upcoming") &&
    onJoin;

  return (
    <article className="competition-card">
      <Link href={`/user/competition/${c.id}`} className="competition-card-banner-link">
        <div
          className="competition-card-banner"
          style={
            c.bannerImage
              ? { backgroundImage: `url(${c.bannerImage})` }
              : { background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)" }
          }
        >
          <span className={`competition-card-status competition-card-status--${c.effectiveStatus}`}>
            {c.effectiveStatus}
          </span>
        </div>
      </Link>
      <div className="competition-card-body">
        <Link href={`/user/competition/${c.id}`} className="competition-card-title">
          {c.title}
        </Link>
        {c.shortDescription ? (
          <p className="competition-card-desc">{c.shortDescription}</p>
        ) : null}
        <div className="competition-card-stats">
          <div>
            <span className="competition-card-stat-label">Prize Pool</span>
            <span className="competition-card-stat-value">{formatINR(c.prizePool)}</span>
          </div>
          <div>
            <span className="competition-card-stat-label">Entry</span>
            <span className="competition-card-stat-value">
              {c.entryType === "paid" ? formatINR(c.entryFee) : "Free"}
            </span>
          </div>
          <div>
            <span className="competition-card-stat-label">Participants</span>
            <span className="competition-card-stat-value">{c.participantCount}</span>
          </div>
          {c.daysLeft != null && c.effectiveStatus !== "completed" ? (
            <div>
              <span className="competition-card-stat-label">Days Left</span>
              <span className="competition-card-stat-value">{c.daysLeft}</span>
            </div>
          ) : null}
        </div>
        <div className="competition-card-actions">
          {c.joined ? (
            <Link href={`/user/competition/${c.id}/trade`} className="competition-card-join-btn competition-card-open-btn">
              Open Competition
            </Link>
          ) : canJoin ? (
            <button
              type="button"
              className="competition-card-join-btn"
              disabled={joining}
              onClick={(e) => {
                e.preventDefault();
                onJoin?.(c.id);
              }}
            >
              {joining ? "Joining…" : "Join Now"}
            </button>
          ) : (
            <Link href={`/user/competition/${c.id}`} className="competition-card-view-btn">
              View Details
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
