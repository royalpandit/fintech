import { FiAward, FiCheckCircle, FiLock } from "react-icons/fi";

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export default function FinuerScoreCard({
  score,
  unlocked,
  unlockScore,
  freeCap,
  breakdown,
}: {
  score: number;
  unlocked: boolean;
  unlockScore: number;
  freeCap: number;
  breakdown: { label: string; count: number; points: number }[];
}) {
  const pct = Math.min(100, Math.round((score / unlockScore) * 100));

  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <FiAward size={18} style={{ color: "#f59e0b" }} />
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
          Finuer Score
        </h2>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: -0.5,
          }}
        >
          {score}
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
            {" "}
            / {unlockScore}
          </span>
        </span>
      </div>

      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text-muted)" }}>
        {unlocked ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#16a34a", fontWeight: 600 }}>
            <FiCheckCircle size={13} /> Higher balance unlocked — top up beyond {formatINR(freeCap)}.
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FiLock size={13} /> Reach {unlockScore} to top up beyond {formatINR(freeCap)}. Earn points
            by posting and interacting on Finuer.
          </span>
        )}
      </p>

      {/* Progress bar */}
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "var(--surface-2)",
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: unlocked
              ? "linear-gradient(90deg, #16a34a, #10b981)"
              : "linear-gradient(90deg, #0ea5e9, #6366f1)",
            transition: "width 0.3s",
          }}
        />
      </div>

      {/* Breakdown of how the score is earned */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
        }}
      >
        {breakdown.map((b) => (
          <div
            key={b.label}
            style={{
              background: "var(--surface-2)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{b.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              {b.count}
              <span style={{ fontSize: 11, fontWeight: 600, color: "#0ea5e9" }}> · +{b.points}</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
