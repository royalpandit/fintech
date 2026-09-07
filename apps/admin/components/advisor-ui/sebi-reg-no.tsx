/**
 * An advisor's SEBI registration number, rendered the same way everywhere.
 *
 * Why it needs to be on every post rather than only on the profile: each
 * surface is independently consumable. Someone reads a buy call in the feed,
 * or opens a shared link to a single post, and acts on it without ever visiting
 * the advisor's profile. The registration number is what lets them check the
 * person making the recommendation against SEBI's public register, so it has to
 * travel with the recommendation.
 *
 * It is deliberately the *number*, not the phrase "SEBI Registered Analyst".
 * A claim of registration with nothing to verify it against is the thing the
 * disclosure rule exists to prevent — and the Trade Calls list was showing
 * exactly that while having the real number available in its props.
 *
 * Placement, consistently: the muted second line of the byline, directly under
 * the advisor's name and ahead of the timestamp. It belongs with the identity
 * because it qualifies *who* is speaking, but it is secondary text because the
 * name is what the reader is scanning for.
 */

/** Monospace: it is an identifier to be compared character by character. */
const numberStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  letterSpacing: "0.01em",
};

export default function SebiRegNo({
  value,
  /**
   * Shown when an advisor has no number on file. Defaults to nothing, which
   * suits a byline; a detail page may prefer to say so explicitly.
   */
  fallback = null,
}: {
  value?: string | null;
  fallback?: React.ReactNode;
}) {
  const reg = value?.trim();
  if (!reg) return <>{fallback}</>;

  return (
    <span
      style={numberStyle}
      // The full value even when the line is truncated, and it explains what
      // the string is to anyone who does not recognise the format.
      title={`SEBI registration number ${reg} — verify on the SEBI register`}
    >
      SEBI {reg}
    </span>
  );
}
