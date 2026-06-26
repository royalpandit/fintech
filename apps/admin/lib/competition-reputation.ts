export const FINUER_LEVELS = [
  { min: 5000, label: "Finuer Elite" },
  { min: 2500, label: "Pro Investor" },
  { min: 1000, label: "Expert" },
  { min: 500, label: "Investor" },
  { min: 100, label: "Learner" },
  { min: 0, label: "Beginner" },
] as const;

export function getFinuerLevel(score: number): string {
  for (const level of FINUER_LEVELS) {
    if (score >= level.min) return level.label;
  }
  return "Beginner";
}

export function getPredictionAccuracy(won: number, participated: number): number {
  if (participated <= 0) return 0;
  return Math.round((won / participated) * 100);
}

export type UserPredictionStatsView = {
  finuerScore: number;
  competitionsParticipated: number;
  competitionsWon: number;
  competitionsLost: number;
  predictionAccuracy: number;
  currentWinningStreak: number;
  bestWinningStreak: number;
  lastCompetitionPlayedAt: string | null;
  finuerLevel: string;
};

export function serializePredictionStats(stats: {
  finuerScore: number;
  competitionsParticipated: number;
  competitionsWon: number;
  competitionsLost: number;
  currentWinningStreak: number;
  bestWinningStreak: number;
  lastCompetitionPlayedAt: Date | null;
}): UserPredictionStatsView {
  return {
    finuerScore: stats.finuerScore,
    competitionsParticipated: stats.competitionsParticipated,
    competitionsWon: stats.competitionsWon,
    competitionsLost: stats.competitionsLost,
    predictionAccuracy: getPredictionAccuracy(
      stats.competitionsWon,
      stats.competitionsParticipated,
    ),
    currentWinningStreak: stats.currentWinningStreak,
    bestWinningStreak: stats.bestWinningStreak,
    lastCompetitionPlayedAt: stats.lastCompetitionPlayedAt?.toISOString() ?? null,
    finuerLevel: getFinuerLevel(stats.finuerScore),
  };
}
