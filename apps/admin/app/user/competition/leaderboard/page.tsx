import { cookies } from "next/headers";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { requireAuthToken } from "@/lib/auth";
import { competitionRepository } from "@/lib/competition-repository";
import GlobalLeaderboard from "@/components/competition/global-leaderboard";

export const dynamic = "force-dynamic";

export default async function CompetitionLeaderboardPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const userId = auth?.userId ?? null;

  const [rows, stats] = await Promise.all([
    competitionRepository.getGlobalLeaderboard("all"),
    userId ? competitionRepository.getUserStats(userId) : Promise.resolve(null),
  ]);

  const tiles = stats
    ? [
        { label: "Accuracy", value: `${stats.predictionAccuracy}%` },
        { label: "Won", value: stats.competitionsWon.toString() },
        { label: "Lost", value: stats.competitionsLost.toString() },
        { label: "Current streak", value: `${stats.currentWinningStreak}🔥` },
        { label: "Best streak", value: stats.bestWinningStreak.toString() },
      ]
    : [];

  return (
    <section>
      <Link href="/user/competition" className="user-page-back-link" style={{ marginBottom: 12 }}>
        <span className="user-page-back-icon"><FiArrowLeft size={14} /></span>
        Competitions
      </Link>
      <h1 className="page-title">Leaderboard</h1>
      <p className="page-subtitle">Ranked by Finuer Score earned from prediction competitions.</p>

      {stats && (
        <article className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Your Finuer Score</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 2 }}>
                <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>
                  {stats.finuerScore.toLocaleString("en-IN")}
                </span>
                <span style={{ padding: "3px 12px", borderRadius: 999, background: "var(--primary-soft)", color: "var(--primary)", fontSize: 12, fontWeight: 700 }}>
                  {stats.finuerLevel}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {tiles.map((t) => (
                <div key={t.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{t.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </article>
      )}

      <GlobalLeaderboard initialRows={rows} />
    </section>
  );
}
