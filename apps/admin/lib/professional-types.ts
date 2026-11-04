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

export const REGULATED_REGISTRATION_TYPES = [
  { value: "investment_advisor", label: "Investment Adviser (INA)", prefix: "INA" },
  { value: "research_analyst", label: "Research Analyst (INH)", prefix: "INH" },
  { value: "portfolio_manager", label: "Portfolio Manager (INP)", prefix: "INP" },
  { value: "stock_broker", label: "Stock Broker (INZ)", prefix: "INZ" },
  { value: "mutual_fund_distributor", label: "Mutual Fund Distributor (ARN)", prefix: "ARN-" },
] as const;

export type RegulatedRegistrationType = (typeof REGULATED_REGISTRATION_TYPES)[number]["value"];

export type ProfessionalDetails = Record<string, string>;

export function professionalDetailsFromUnknown(value: unknown): ProfessionalDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

const REGISTRATION_PREFIX: Partial<Record<ProfessionalType, string>> = {
  investment_advisor: "INA",
  research_analyst: "INH",
  portfolio_manager: "INP",
  stock_broker: "INZ",
  mutual_fund_distributor: "ARN-",
};

function isRegulatedRegistrationType(value: unknown): value is RegulatedRegistrationType {
  return REGULATED_REGISTRATION_TYPES.some((type) => type.value === value);
}

export function registrationFieldLabel(type: ProfessionalType, details: ProfessionalDetails = {}) {
  if (type === "advisory_firm" || type === "wealth_manager") {
    const selected = REGULATED_REGISTRATION_TYPES.find((item) => item.value === details.regulatoryType);
    return selected ? `${selected.label} registration number` : "Select a regulatory type first";
  }
  if (type === "financial_platform" || type === "listed_company") return "Company CIN";
  if (type === "mutual_fund_distributor") return "AMFI ARN";
  return "SEBI Registration Number";
}

export function registrationFieldPlaceholder(type: ProfessionalType, details: ProfessionalDetails = {}) {
  if (type === "financial_platform" || type === "listed_company") return "21-character CIN";
  if (type === "advisory_firm" || type === "wealth_manager") {
    const selected = REGULATED_REGISTRATION_TYPES.find((item) => item.value === details.regulatoryType);
    return selected ? `${selected.prefix}${selected.value === "mutual_fund_distributor" ? "123456" : "000000001"}` : "Select type first";
  }
  if (type === "mutual_fund_distributor") return "ARN-123456";
  return `${REGISTRATION_PREFIX[type] ?? "Registration"}000000001`;
}

export function registrationCaption(type: ProfessionalType, details: ProfessionalDetails = {}) {
  if (type === "finance_creator") return "Social profiles";
  if (type === "financial_platform" || type === "listed_company") return "Company CIN";
  const registrationType =
    type === "advisory_firm" || type === "wealth_manager"
      ? details.regulatoryType
      : type;
  if (registrationType === "mutual_fund_distributor") return "AMFI ARN";
  if (
    registrationType === "investment_advisor" ||
    registrationType === "research_analyst" ||
    registrationType === "portfolio_manager" ||
    registrationType === "stock_broker"
  ) return "SEBI Registration No.";
  return "Registration";
}

export function validateProfessionalCredentials(
  type: ProfessionalType,
  registrationNo: string,
  details: ProfessionalDetails,
): string | null {
  const registration = registrationNo.trim().toUpperCase();
  const entityName = (details.entityName ?? "").trim();

  if (type === "investment_advisor" || type === "research_analyst" ||
      type === "portfolio_manager" || type === "stock_broker") {
    const prefix = REGISTRATION_PREFIX[type]!;
    if (!new RegExp(`^${prefix}[0-9]{9}$`).test(registration)) {
      return `Registration number must match ${prefix} followed by 9 digits.`;
    }
    return null;
  }

  if (type === "mutual_fund_distributor") {
    return /^ARN-[0-9]{1,8}$/.test(registration)
      ? null
      : "AMFI ARN must be in the format ARN- followed by digits.";
  }

  if (type === "advisory_firm" || type === "wealth_manager") {
    if (!entityName) return "Registered firm / entity name is required.";
    if (!isRegulatedRegistrationType(details.regulatoryType)) {
      return "Select the registration category for this firm / wealth manager.";
    }
    const prefix = REGISTRATION_PREFIX[details.regulatoryType]!;
    const pattern = details.regulatoryType === "mutual_fund_distributor"
      ? /^ARN-[0-9]{1,8}$/
      : new RegExp(`^${prefix}[0-9]{9}$`);
    return pattern.test(registration)
      ? null
      : `${REGULATED_REGISTRATION_TYPES.find((item) => item.value === details.regulatoryType)!.label} registration number is invalid.`;
  }

  if (type === "financial_platform" || type === "listed_company") {
    if (!entityName) return "Registered company name is required.";
    if (!/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(registration)) {
      return "CIN must be a valid 21-character Indian company identification number.";
    }
    if (type === "listed_company") {
      const exchange = details.exchange;
      const ticker = (details.ticker ?? "").trim().toUpperCase();
      if (exchange !== "NSE" && exchange !== "BSE") return "Select NSE or BSE.";
      if (!/^[A-Z0-9&.-]{1,20}$/.test(ticker)) return "Enter a valid NSE / BSE ticker.";
    }
    return null;
  }

  if (type === "finance_creator") {
    const socialSites: { key: string; label: string; hosts: string[] }[] = [
      { key: "instagramUrl", label: "Instagram", hosts: ["instagram.com", "www.instagram.com", "m.instagram.com"] },
      { key: "youtubeUrl", label: "YouTube", hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"] },
    ];
    for (const { key, label, hosts } of socialSites) {
      const rawUrl = (details[key] ?? "").trim();
      if (!rawUrl) return `${label} profile URL is required.`;
      try {
        const url = new URL(rawUrl);
        const host = url.hostname.toLowerCase();
        if (url.protocol !== "https:" || !hosts.includes(host) || url.pathname === "/") {
          return `Enter a valid HTTPS ${label} profile URL.`;
        }
      } catch {
        return `Enter a valid HTTPS ${label} profile URL.`;
      }
    }
    return null;
  }

  return "Unsupported professional type.";
}

const LABELS: Record<string, string> = Object.fromEntries(
  PROFESSIONAL_TYPES.map((t) => [t.value, t.label]),
);

export function professionalTypeLabel(value: string | null | undefined): string {
  if (!value) return "Investment Advisor";
  return LABELS[value] ?? "Investment Advisor";
}

export function isProfessionalType(value: unknown): value is ProfessionalType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LABELS, value);
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
