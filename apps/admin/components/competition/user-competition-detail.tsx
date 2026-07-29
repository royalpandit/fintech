"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserPageBackLink, UserPageSection } from "@/components/user/user-page-layout";

type Option = { id: number; label: string };
type Prediction = {
  optionId: number;
  optionLabel: string | null;
  isCorrect: boolean | null;
  pointsEarned: number;
};

type Detail = {
  id: number;
  title: string;
  description?: string | null;
  bannerImage?: string | null;
  tags?: string[];
  question?: string | null;
  options: Option[];
  reputationPoints: number;
  participantCount: number;
  participationEndDate: string;
  endDate: string;
  effectiveStatus: string;
  participationOpen: boolean;
  hasPrediction: boolean;
  allowPredictionChange: boolean;
  userPrediction?: Prediction | null;
  resultDeclaredAt?: string | null;
  winningOptionLabel?: string | null;
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
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/competitions/${id}`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    }).then(async (r) => {
      const j = await r.json();
      if (j.ok) {
        setData(j.data);
        if (j.data.userPrediction?.optionId) {
          setSelectedOption(j.data.userPrediction.optionId);
          const locked =
            j.data.resultDeclaredAt ||
            (!j.data.allowPredictionChange && j.data.hasPrediction);
          setSubmitted(locked);
        }
      }
      setLoading(false);
    });
  }, [id]);

  async function submitPrediction() {
    if (!selectedOption) {
      alert("Please select an answer option");
      return;
    }
    setSubmitting(true);
    const t = getToken();
    const r = await fetch(`/api/v1/competitions/${id}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify({ optionId: selectedOption }),
    });
    const j = await r.json();
    setSubmitting(false);
    if (j.ok) {
      setSubmitted(true);
      setData((prev) =>
        prev
          ? {
              ...prev,
              hasPrediction: true,
              userPrediction: j.data,
            }
          : prev,
      );
    } else {
      alert(j.error || "Failed to submit prediction");
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
        <UserPageBackLink href="/user/competition">← Back to Competitions</UserPageBackLink>
        <p>Competition not found.</p>
      </UserPageSection>
    );
  }

  const resultDeclared = Boolean(data.resultDeclaredAt);
  const userWon = data.userPrediction?.isCorrect === true;
  const hasQuestion = Boolean(data.question?.trim());
  const hasOptions = data.options.length >= 2;
  const isConfigured = hasQuestion && hasOptions;
  const canSubmit =
    isConfigured &&
    data.participationOpen &&
    (!data.hasPrediction || (data.allowPredictionChange && !resultDeclared));

  if (submitted && data.hasPrediction && !resultDeclared) {
    return (
      <UserPageSection>
        <UserPageBackLink href="/user/competition">← Back to Competitions</UserPageBackLink>
        <div className="competition-detail-section" style={{ textAlign: "center", padding: "32px 16px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h1 className="competition-detail-title">Prediction Submitted Successfully</h1>
          <p style={{ marginTop: 16 }}>
            <strong>Your Prediction:</strong> {data.userPrediction?.optionLabel}
          </p>
          <p>
            <strong>Status:</strong> Prediction Locked
          </p>
          <p>
            <strong>Competition Ends:</strong>{" "}
            {new Date(data.endDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <p>
            <strong>Reputation Points:</strong> +{data.reputationPoints}
          </p>
          <button
            type="button"
            className="competition-card-join-btn"
            style={{ marginTop: 24 }}
            onClick={() => router.push("/user/competition")}
          >
            Back to Competitions
          </button>
        </div>
      </UserPageSection>
    );
  }

  if (resultDeclared) {
    return (
      <UserPageSection>
        <UserPageBackLink href="/user/competition">← Back to Competitions</UserPageBackLink>
        <div className="competition-detail-section">
          <h1 className="competition-detail-title">🏆 Competition Completed</h1>
          <p style={{ marginTop: 12 }}>
            <strong>Question:</strong> {data.question}
          </p>
          <p>
            <strong>Winning Answer:</strong> ✅ {data.winningOptionLabel}
          </p>
          {data.userPrediction ? (
            <>
              <p>
                <strong>Your Prediction:</strong>{" "}
                {userWon ? "✅" : "❌"} {data.userPrediction.optionLabel}
              </p>
              <p>
                <strong>Result:</strong> {userWon ? "You Won" : "Better luck next time"}
              </p>
              <p>
                <strong>Points Earned:</strong>{" "}
                {userWon ? `+${data.userPrediction.pointsEarned} Reputation Points` : "0 Reputation Points"}
              </p>
            </>
          ) : (
            <p>You did not participate in this competition.</p>
          )}
          <div className="competition-detail-actions">
            <Link href={`/user/competition/${id}/leaderboard`} className="competition-card-join-btn">
              View Leaderboard
            </Link>
            <Link href="/user/competition/my-predictions" className="competition-card-view-btn">
              My Predictions
            </Link>
          </div>
        </div>
      </UserPageSection>
    );
  }

  return (
    <UserPageSection>
      <UserPageBackLink href="/user/competition">← Back to Competitions</UserPageBackLink>

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
          {data.effectiveStatus === "live" ? "Live" : data.effectiveStatus}
        </span>
      </div>

      {data.description ? <p style={{ marginTop: 8 }}>{data.description}</p> : null}

      <div className="competition-detail-meta">
        <div>
          <strong>Participation Ends:</strong>{" "}
          {new Date(data.participationEndDate).toLocaleString("en-IN")}
        </div>
        <div>
          <strong>Competition Ends:</strong>{" "}
          {new Date(data.endDate).toLocaleString("en-IN")}
        </div>
        <div>
          <strong>Participants:</strong> {data.participantCount.toLocaleString("en-IN")}
        </div>
        <div>
          <strong>Reputation Points:</strong> +{data.reputationPoints}
        </div>
      </div>

      {isConfigured ? (
        <section className="competition-detail-section">
          <h2>Question</h2>
          <p>{data.question}</p>
          <div style={{ marginTop: 16 }}>
            {data.options.map((opt) => (
              <label
                key={opt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border)",
                  cursor: canSubmit ? "pointer" : "default",
                }}
              >
                <input
                  type="radio"
                  name="prediction"
                  disabled={!canSubmit}
                  checked={selectedOption === opt.id}
                  onChange={() => setSelectedOption(opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </section>
      ) : (
        <section className="competition-detail-section">
          <h2>Not ready yet</h2>
          <p style={{ color: "var(--text-muted)" }}>
            This competition does not have a prediction question configured yet. Please check back
            later or contact the admin.
          </p>
        </section>
      )}

      {!data.participationOpen && !data.hasPrediction && isConfigured ? (
        <p style={{ color: "var(--text-muted)", marginTop: 12 }}>
          Participation window is closed. You can no longer submit a prediction.
        </p>
      ) : null}

      <div className="competition-detail-actions">
        {canSubmit ? (
          <button
            type="button"
            className="competition-card-join-btn"
            disabled={submitting || !selectedOption}
            onClick={submitPrediction}
          >
            {submitting ? "Submitting…" : data.hasPrediction ? "Update Prediction" : "Submit Prediction"}
          </button>
        ) : data.hasPrediction ? (
          <p>✅ Prediction submitted — locked until results are declared.</p>
        ) : isConfigured && !getToken() ? (
          <Link href="/login" className="competition-card-join-btn">
            Sign in to Participate
          </Link>
        ) : null}
        <Link href={`/user/competition/${id}/leaderboard`} className="competition-card-view-btn">
          View Leaderboard
        </Link>
      </div>
    </UserPageSection>
  );
}
