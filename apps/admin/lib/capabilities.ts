// ─────────────────────────────────────────────────────────────────────────────
// Capability model — encodes the "Roles and permissions in finuer" matrix.
//
// This is the SINGLE SOURCE OF TRUTH for what each professional type may do.
// Defaults match the Roles & Permissions chart. Call `can()` / `canType()` at
// feature gates (subscriptions, courses, trade posts, etc.). Super-admin can
// override per type in the Permissions editor (DB matrix).
//
// Open decisions baked in (change here, not at call sites):
//   [1] RIA (investment_advisor) is placed in the "advisor_distributor" tier per
//       the doc's column 2, which means it does NOT get buy/sell targets or
//       Entry/Target/SL posts. If RIAs should be allowed to issue advice, move
//       "investment_advisor" to the "sebi_analyst" tier in TYPE_TIER below.
//   [2] The "badge.verified" capability is marked paid-for-all per the doc. If
//       SEBI verification should stay free (compliance, not monetization), drop
//       it from CAPABILITY_TIERS and keep it out of the paywall.
//   [3] Finuer Basket, Competitions, Virtual Trading and Messages are NOT in the
//       source matrix — add capabilities for them once the doc defines who can
//       create/participate. Listed under UNSPECIFIED below.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProfessionalType } from "./professional-types";

// The doc groups 10 professional types into 5 permission tiers (matrix columns).
export type PermissionTier =
  | "sebi_analyst" //        Col 1: SEBI Analysts & Advisory Firms
  | "advisor_distributor" // Col 2: RIA / Wealth advisors / MF Distributors (ARN) / PMS
  | "creator" //             Col 3: Finance Creators & Educators
  | "listed_company" //      Col 4: Listed Companies
  | "platform_broker"; //    Col 5: Financial Platforms / Stock Brokers

// Current enum value → tier. The commented rows are professional types the doc
// lists but the ProfessionalType enum doesn't have yet — extending the enum is
// then a one-line addition here (plus a Prisma migration).
export const TYPE_TIER: Record<ProfessionalType, PermissionTier> = {
  research_analyst: "sebi_analyst",
  advisory_firm: "sebi_analyst",
  investment_advisor: "advisor_distributor", //      RIA — see note [1]
  portfolio_manager: "advisor_distributor", //       PMS
  wealth_manager: "advisor_distributor", //          Wealth advisor
  mutual_fund_distributor: "advisor_distributor", // ARN
  stock_broker: "platform_broker",
  finance_creator: "creator",
  listed_company: "listed_company",
  financial_platform: "platform_broker",
};

export type Capability =
  | "post.normal"
  | "social.interact" //            comment / like / share
  | "community.create"
  | "badge.verified" //             paid — note [2]
  | "post.polls"
  | "course.sell"
  | "course.boost"
  | "report.sell" //                reports / PDFs
  | "post.boost"
  | "event.webinar" //              run webinars / events
  | "monetize.paid_subscription"
  | "chat.premium_room"
  | "advisory.buy_sell_targets"
  | "post.entry_target_sl"
  | "advisory.premium_unlock"
  | "upload.investor_presentation"
  | "company.announcements"
  | "promote.services"
  | "analytics.dashboard";

const ALL: PermissionTier[] = [
  "sebi_analyst",
  "advisor_distributor",
  "creator",
  "listed_company",
  "platform_broker",
];

// Which tiers hold each capability, straight from the matrix.
// An empty array means "nobody" (admin/platform-only, e.g. creating communities).
export const CAPABILITY_TIERS: Record<Capability, PermissionTier[]> = {
  "post.normal": ALL,
  "social.interact": ALL,
  "community.create": [], // all professionals ❌ — admin/platform only
  "badge.verified": ALL, // paid
  "post.polls": ["sebi_analyst", "advisor_distributor", "creator", "platform_broker"], // not listed_company
  "course.sell": ["sebi_analyst", "advisor_distributor", "creator", "platform_broker"],
  "course.boost": ["sebi_analyst", "advisor_distributor", "creator", "platform_broker"],
  "report.sell": ["sebi_analyst"],
  "post.boost": ALL,
  "event.webinar": ALL,
  "monetize.paid_subscription": ["sebi_analyst", "advisor_distributor"],
  "chat.premium_room": ["sebi_analyst", "advisor_distributor"],
  "advisory.buy_sell_targets": ["sebi_analyst"],
  "post.entry_target_sl": ["sebi_analyst"],
  "advisory.premium_unlock": ["sebi_analyst"],
  "upload.investor_presentation": ["sebi_analyst", "listed_company", "platform_broker"],
  "company.announcements": ["listed_company", "platform_broker"],
  "promote.services": ALL,
  "analytics.dashboard": ALL,
};

// Capabilities the source matrix does NOT yet define — decide + add later:
// "basket.create" (Finuer Basket), "competition.participate" (Competitions),
// "trading.virtual" (Virtual Trading), "messages.dm".

/** Resolve a professional type to its permission tier (defaults to advisor/RIA tier). */
export function tierFor(type: ProfessionalType | null | undefined): PermissionTier {
  if (!type) return "advisor_distributor";
  return TYPE_TIER[type] ?? "advisor_distributor";
}

/** Whether a professional type holds a capability. Retail users hold none of these. */
export function can(type: ProfessionalType | null | undefined, cap: Capability): boolean {
  return CAPABILITY_TIERS[cap].includes(tierFor(type));
}

/** Every capability a professional type holds — handy for building UI/menus. */
export function capabilitiesFor(type: ProfessionalType | null | undefined): Capability[] {
  const tier = tierFor(type);
  return (Object.keys(CAPABILITY_TIERS) as Capability[]).filter((c) =>
    CAPABILITY_TIERS[c].includes(tier),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UI metadata — labels, categories, and presets for the super-admin editor.
// ─────────────────────────────────────────────────────────────────────────────

export type CapabilityCategory =
  | "Content & Community"
  | "Monetization"
  | "Advisory / Trading"
  | "Corporate"
  | "Analytics";

export const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  "Content & Community",
  "Monetization",
  "Advisory / Trading",
  "Corporate",
  "Analytics",
];

export const CAPABILITY_META: Record<Capability, { label: string; category: CapabilityCategory }> = {
  "post.normal": { label: "Create normal posts", category: "Content & Community" },
  "social.interact": { label: "Comment / Like / Share", category: "Content & Community" },
  "community.create": { label: "Create communities", category: "Content & Community" },
  "post.polls": { label: "Post polls", category: "Content & Community" },
  "post.boost": { label: "Boost posts", category: "Content & Community" },
  "event.webinar": { label: "Run webinars / events", category: "Content & Community" },
  "promote.services": { label: "Promote services / tools", category: "Content & Community" },
  "badge.verified": { label: "Verified badge", category: "Monetization" },
  "course.sell": { label: "Sell courses", category: "Monetization" },
  "course.boost": { label: "Boost courses", category: "Monetization" },
  "report.sell": { label: "Sell reports / PDFs", category: "Monetization" },
  "monetize.paid_subscription": { label: "Paid subscriptions", category: "Monetization" },
  "chat.premium_room": { label: "Premium chatrooms", category: "Monetization" },
  "advisory.buy_sell_targets": { label: "Advisory buy/sell targets", category: "Advisory / Trading" },
  "post.entry_target_sl": { label: "Entry / Target / SL posts", category: "Advisory / Trading" },
  "advisory.premium_unlock": { label: "Premium advisory unlocks", category: "Advisory / Trading" },
  "upload.investor_presentation": { label: "Upload investor presentations", category: "Corporate" },
  "company.announcements": { label: "Company announcements", category: "Corporate" },
  "analytics.dashboard": { label: "Analytics dashboard", category: "Analytics" },
};

export const ALL_CAPABILITIES = Object.keys(CAPABILITY_TIERS) as Capability[];

export function isCapability(v: unknown): v is Capability {
  return typeof v === "string" && (v as string) in CAPABILITY_TIERS;
}

// Preset bundles — starting points the admin applies, then fine-tunes.
export const CAPABILITY_PRESETS: { id: string; label: string; capabilities: Capability[] }[] = [
  {
    id: "content",
    label: "Content",
    capabilities: [
      "post.normal",
      "social.interact",
      "post.polls",
      "post.boost",
      "event.webinar",
      "promote.services",
      "analytics.dashboard",
      "badge.verified",
    ],
  },
  {
    id: "distributor",
    label: "Distributor",
    capabilities: [
      "post.normal",
      "social.interact",
      "post.polls",
      "post.boost",
      "event.webinar",
      "promote.services",
      "analytics.dashboard",
      "badge.verified",
      "monetize.paid_subscription",
      "chat.premium_room",
      "course.sell",
      "course.boost",
    ],
  },
  {
    id: "advisory",
    label: "Advisory (SEBI)",
    capabilities: [
      "post.normal",
      "social.interact",
      "post.polls",
      "post.boost",
      "event.webinar",
      "promote.services",
      "analytics.dashboard",
      "badge.verified",
      "monetize.paid_subscription",
      "chat.premium_room",
      "course.sell",
      "course.boost",
      "report.sell",
      "advisory.buy_sell_targets",
      "post.entry_target_sl",
      "advisory.premium_unlock",
    ],
  },
  {
    id: "corporate",
    label: "Corporate",
    capabilities: [
      "post.normal",
      "social.interact",
      "post.boost",
      "promote.services",
      "analytics.dashboard",
      "badge.verified",
      "upload.investor_presentation",
      "company.announcements",
    ],
  },
  {
    id: "full",
    label: "Full access",
    capabilities: ALL_CAPABILITIES,
  },
];
