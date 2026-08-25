// ─── Stock Basket / AI Stock Picks — RETIRED ──────────────────────────────
// Superseded by Finuer Basket (/user/finuer-basket, /super-admin/finuer-basket).
// The original implementation is preserved verbatim, line-commented, below the
// stub. To bring the feature back: delete the stub, uncomment the body, and
// restore the nav entries in components/user-shell.tsx + lib/super-admin.ts.

// Nothing imports this module any more — the whole component is preserved
// commented out below so the feature can be restored in one revert.

export {};

// ─── Original implementation (commented out) ───────────────────────────

// import { RECOMMENDATION_COLORS, RECOMMENDATION_LABELS } from "@/lib/stock-picks";
//
// type Props = {
//   recommendation: string;
//   size?: "sm" | "md";
// };
//
// export default function RecommendationBadge({ recommendation, size = "sm" }: Props) {
//   const style = RECOMMENDATION_COLORS[recommendation] ?? RECOMMENDATION_COLORS.hold;
//   const label = RECOMMENDATION_LABELS[recommendation] ?? recommendation;
//
//   return (
//     <span
//       style={{
//         display: "inline-block",
//         fontSize: size === "md" ? 11 : 10,
//         fontWeight: 700,
//         padding: size === "md" ? "4px 10px" : "3px 8px",
//         borderRadius: 20,
//         background: style.bg,
//         color: style.color,
//         letterSpacing: 0.2,
//         whiteSpace: "nowrap",
//       }}
//     >
//       {label}
//     </span>
//   );
// }
