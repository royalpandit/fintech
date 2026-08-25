export type LandingAdvisor = {
  id: number;
  name: string;
  sebi: string;
  expertise: string;
  years: number;
  /**
   * Mean ROI over the last 30 days of `advisor_metrics_daily`.
   *
   * `null` when we have no metrics for this advisor — the card then shows a
   * follower count instead. This must never be synthesised: it is a performance
   * figure attributed to a named, SEBI-registered professional on a public page,
   * so an invented number is a compliance problem, not a cosmetic one.
   */
  returnsPct: number | null;
  /** Verified followers — the truthful stat shown when `returnsPct` is null. */
  followers: number;
  initials: string;
  /** Uploaded profile picture; falls back to `initials` when absent. */
  avatarUrl: string | null;
};
