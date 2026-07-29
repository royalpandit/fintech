"use client";

import Link from "next/link";

export type CompetitionCardData = {
  id: number;
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  bannerImage?: string | null;
  tags?: string[];
  reputationPoints: number;
  participantCount: number;
  participationTimeLeft?: { label: string } | null;
  effectiveStatus: string;
  hasPrediction?: boolean;
  joined?: boolean;
  startDate: string;
  endDate: string;
  participationEndDate?: string;
  resultDeclaredAt?: string | null;
};

type Props = {
  competition: CompetitionCardData;
  onParticipate?: (id: number) => void;
  participating?: boolean;
};

export default function CompetitionCard({ competition, onParticipate, participating }: Props) {
  const c = competition;
  const hasPrediction = c.hasPrediction || c.joined;
  const canParticipate =
    !hasPrediction &&
    c.effectiveStatus !== "completed" &&
    c.effectiveStatus !== "draft" &&
    onParticipate;

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
            {c.effectiveStatus === "live" ? "Live" : c.effectiveStatus}
          </span>
        </div>
      </Link>
      <div className="competition-card-body">
        <Link href={`/user/competition/${c.id}`} className="competition-card-title">
          🏆 {c.title}
        </Link>
        {c.tags && c.tags.length > 0 ? (
          <p className="competition-card-desc">🏷 {c.tags.join(" • ")}</p>
        ) : c.shortDescription || c.description ? (
          <p className="competition-card-desc">{c.shortDescription || c.description}</p>
        ) : null}

        <div className="competition-card-stats">
          {c.participationTimeLeft && !hasPrediction && c.effectiveStatus !== "completed" ? (
            <div>
              <span className="competition-card-stat-label">⏳ Participation Ends</span>
              <span className="competition-card-stat-value">{c.participationTimeLeft.label}</span>
            </div>
          ) : null}
          <div>
            <span className="competition-card-stat-label">🏁 Competition Ends</span>
            <span className="competition-card-stat-value">
              {new Date(c.endDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div>
            <span className="competition-card-stat-label">👥 Participants</span>
            <span className="competition-card-stat-value">{c.participantCount.toLocaleString("en-IN")}</span>
          </div>
          <div>
            <span className="competition-card-stat-label">🏆 Reputation Points</span>
            <span className="competition-card-stat-value">+{c.reputationPoints}</span>
          </div>
        </div>

        <div className="competition-card-actions">
          {hasPrediction ? (
            <Link href={`/user/competition/${c.id}`} className="competition-card-join-btn competition-card-open-btn">
              ✅ Prediction Submitted — View Competition →
            </Link>
          ) : canParticipate ? (
            <button
              type="button"
              className="competition-card-join-btn"
              disabled={participating}
              onClick={(e) => {
                e.preventDefault();
                onParticipate?.(c.id);
              }}
            >
              {participating ? "Loading…" : "Participate"}
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
