// Shared definitions for advisor "professional type" — the 10 categories from the
// "Roles and permissions in finuer" doc. Values mirror the ProfessionalType enum
// in prisma/schema.prisma.

export type ProfessionalType =
  | "research_analyst"
  | "investment_advisor"
  | "portfolio_manager"
  | "wealth_manager"
  | "advisory_firm"
  | "mutual_fund_distributor"
  | "stock_broker"
  | "finance_creator"
  | "listed_company"
  | "financial_platform";

export const PROFESSIONAL_TYPES: { value: ProfessionalType; label: string }[] = [
  { value: "research_analyst", label: "Research Analyst (SEBI)" },
  { value: "investment_advisor", label: "Registered Investment Adviser (RIA)" },
  { value: "portfolio_manager", label: "Portfolio Manager (PMS)" },
  { value: "wealth_manager", label: "Wealth Advisor" },
  { value: "advisory_firm", label: "Research & Advisory Firm" },
  { value: "mutual_fund_distributor", label: "Mutual Fund Distributor (ARN)" },
  { value: "stock_broker", label: "Stock Broker" },
  { value: "finance_creator", label: "Finance Creator & Educator" },
  { value: "listed_company", label: "Listed Company" },
  { value: "financial_platform", label: "Financial Platform" },
];

const LABELS: Record<string, string> = Object.fromEntries(
  PROFESSIONAL_TYPES.map((t) => [t.value, t.label]),
);

export function professionalTypeLabel(value: string | null | undefined): string {
  if (!value) return "Registered Investment Adviser (RIA)";
  return LABELS[value] ?? "Registered Investment Adviser (RIA)";
}

export function isProfessionalType(value: unknown): value is ProfessionalType {
  return typeof value === "string" && value in LABELS;
}
