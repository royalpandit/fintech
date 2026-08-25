// Shared definitions for advisor "professional type" — the categories users can
// filter finance professionals by (analyst, portfolio manager, advisory firm, ...).
// Values mirror the ProfessionalType enum in prisma/schema.prisma.

export type ProfessionalType =
  | "investment_advisor"
  | "research_analyst"
  | "portfolio_manager"
  | "advisory_firm"
  | "wealth_manager"
  | "mutual_fund_distributor"
  | "stock_broker"
  | "finance_creator"
  | "listed_company"
  | "financial_platform";

export const PROFESSIONAL_TYPES: { value: ProfessionalType; label: string }[] = [
  { value: "investment_advisor", label: "Investment Advisor" },
  { value: "research_analyst", label: "Research Analyst" },
  { value: "portfolio_manager", label: "Portfolio Manager" },
  { value: "advisory_firm", label: "Advisory Firm" },
  { value: "wealth_manager", label: "Wealth Manager" },
  { value: "mutual_fund_distributor", label: "Mutual Fund Distributor" },
  { value: "stock_broker", label: "Stock Broker" },
  { value: "finance_creator", label: "Finance Creator" },
  { value: "listed_company", label: "Listed Company" },
  { value: "financial_platform", label: "Financial Platform" },
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

// ─── Short badge labels ───────────────────────────────────────────────────────
// The full labels above carry the regulator suffix ("Registered Investment
// Adviser (RIA)") which is far too long for an inline pill next to a name in the
// feed. These are the compact forms used by <ProfessionTag />.
const SHORT_LABELS: Record<ProfessionalType, string> = {
  research_analyst: "Research Analyst",
  investment_advisor: "Investment Adviser",
  portfolio_manager: "Portfolio Manager",
  wealth_manager: "Wealth Advisor",
  advisory_firm: "Advisory Firm",
  mutual_fund_distributor: "MF Distributor",
  stock_broker: "Stock Broker",
  finance_creator: "Finance Creator",
  listed_company: "Listed Company",
  financial_platform: "Financial Platform",
};

/** Label for the profession pill shown beside an author's name in the feed. */
export function professionalTypeShortLabel(value: string | null | undefined): string {
  if (!value) return "Investor";
  return SHORT_LABELS[value as ProfessionalType] ?? "Investor";
}
