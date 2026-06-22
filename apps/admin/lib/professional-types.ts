// Shared definitions for advisor "professional type" — the categories users can
// filter finance professionals by (analyst, portfolio manager, advisory firm, ...).
// Values mirror the ProfessionalType enum in prisma/schema.prisma.

export type ProfessionalType =
  | "investment_advisor"
  | "research_analyst"
  | "portfolio_manager"
  | "advisory_firm"
  | "wealth_manager";

export const PROFESSIONAL_TYPES: { value: ProfessionalType; label: string }[] = [
  { value: "investment_advisor", label: "Investment Advisor" },
  { value: "research_analyst", label: "Research Analyst" },
  { value: "portfolio_manager", label: "Portfolio Manager" },
  { value: "advisory_firm", label: "Advisory Firm" },
  { value: "wealth_manager", label: "Wealth Manager" },
];

const LABELS: Record<string, string> = Object.fromEntries(
  PROFESSIONAL_TYPES.map((t) => [t.value, t.label]),
);

export function professionalTypeLabel(value: string | null | undefined): string {
  if (!value) return "Investment Advisor";
  return LABELS[value] ?? "Investment Advisor";
}

export function isProfessionalType(value: unknown): value is ProfessionalType {
  return typeof value === "string" && value in LABELS;
}
