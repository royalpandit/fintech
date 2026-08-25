import type { CSSProperties } from "react";
import { professionalTypeShortLabel } from "@/lib/professional-types";

/**
 * The small pill shown beside an author's name in the feed saying *what they
 * are* — "Research Analyst", "Portfolio Manager", … for verified professionals
 * and "Investor" for everyone else. Colour-coded by family so a regulated
 * adviser is visually distinct from a creator or a plain retail investor.
 *
 * Pass `professionalType = null` (the default) for a non-advisor author.
 */
type Tone = { bg: string; fg: string; border: string };

const REGULATED: Tone = { bg: "rgba(16,185,129,0.10)", fg: "#047857", border: "rgba(16,185,129,0.30)" };
const MARKETS: Tone = { bg: "rgba(14,165,233,0.10)", fg: "#0369a1", border: "rgba(14,165,233,0.28)" };
const CREATOR: Tone = { bg: "rgba(168,85,247,0.10)", fg: "#7e22ce", border: "rgba(168,85,247,0.28)" };
const CORPORATE: Tone = { bg: "rgba(245,158,11,0.12)", fg: "#b45309", border: "rgba(245,158,11,0.30)" };
const INVESTOR: Tone = { bg: "var(--surface-2)", fg: "var(--text-muted)", border: "var(--border)" };

const TONES: Record<string, Tone> = {
  research_analyst: REGULATED,
  investment_advisor: REGULATED,
  portfolio_manager: REGULATED,
  advisory_firm: REGULATED,
  wealth_manager: MARKETS,
  mutual_fund_distributor: MARKETS,
  stock_broker: MARKETS,
  finance_creator: CREATOR,
  listed_company: CORPORATE,
  financial_platform: CORPORATE,
};

export default function ProfessionTag({
  professionalType = null,
  size = "md",
  title,
  style,
}: {
  professionalType?: string | null;
  size?: "sm" | "md";
  /** Tooltip override — e.g. the full regulator label on the advisor cards. */
  title?: string;
  style?: CSSProperties;
}) {
  const label = professionalTypeShortLabel(professionalType);
  const tone = (professionalType && TONES[professionalType]) || INVESTOR;
  const small = size === "sm";

  return (
    <span
      title={title ?? label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        maxWidth: "100%",
        padding: small ? "1px 7px" : "2px 8px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        fontSize: small ? 9.5 : 10,
        fontWeight: 700,
        lineHeight: 1.5,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        ...style,
      }}
    >
      {label}
    </span>
  );
}
