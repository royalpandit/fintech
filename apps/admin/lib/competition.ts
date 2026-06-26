import type {
  Competition,
  CompetitionLeaderboard,
  CompetitionOption,
  CompetitionParticipant,
  CompetitionPrediction,
  CompetitionRole,
  User,
} from "@prisma/client";
import type { UserRole } from "@/lib/auth";
import { getFinuerLevel, getPredictionAccuracy } from "@/lib/competition-reputation";

export function toNumber(value: { toString(): string } | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : Number(value);
}

export const COMPETITION_STATUSES = ["draft", "upcoming", "live", "completed", "cancelled"] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const COMPETITION_VISIBILITIES = [
  "public",
  "hidden",
  "pro_members",
  "financial_professionals",
] as const;
export type CompetitionVisibility = (typeof COMPETITION_VISIBILITIES)[number];

export const COMPETITION_VISIBILITY_LABELS: Record<CompetitionVisibility, string> = {
  public: "Public",
  hidden: "Hidden",
  pro_members: "Finuer Pro Members",
  financial_professionals: "Financial Professionals",
};

export const COMPETITION_ENTRY_TYPES = ["free", "paid"] as const;
export type CompetitionEntryType = (typeof COMPETITION_ENTRY_TYPES)[number];

export const COMPETITION_ROLE_KEYS = ["user", "advisor", "creator", "analyst", "all"] as const;
export type CompetitionRoleKey = (typeof COMPETITION_ROLE_KEYS)[number];

export const COMPETITION_ROLE_IDS: Record<CompetitionRoleKey, number> = {
  user: 1,
  advisor: 2,
  creator: 3,
  analyst: 4,
  all: 5,
};

export const COMPETITION_ROLE_LABELS: Record<CompetitionRoleKey, string> = {
  user: "User",
  advisor: "Advisor",
  creator: "Creator",
  analyst: "Analyst",
  all: "All Roles",
};

export const COMPETITION_TAGS = [
  "Stocks",
  "IPO",
  "Earnings",
  "Economy",
  "Crypto",
  "Mutual Funds",
  "Commodities",
  "Banking",
  "IT",
  "Pharma",
  "Defence",
] as const;
export type CompetitionTag = (typeof COMPETITION_TAGS)[number];

export const COMPETITION_USER_TABS = ["live", "upcoming", "completed", "my"] as const;
export type CompetitionUserTab = (typeof COMPETITION_USER_TABS)[number];

export type CompetitionWithRelations = Competition & {
  allowedRoles?: CompetitionRole[];
  options?: CompetitionOption[];
  winningOption?: CompetitionOption | null;
  createdBy?: Pick<User, "id" | "fullName" | "email"> | null;
  _count?: { participants?: number; predictions?: number };
};

export type CompetitionDetail = ReturnType<typeof serializeCompetition> & {
  userPrediction?: ReturnType<typeof serializePrediction> | null;
  winningOptionLabel?: string | null;
};

export function formatINR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function parseCompetitionStatus(value: unknown): CompetitionStatus {
  if (typeof value === "string" && COMPETITION_STATUSES.includes(value as CompetitionStatus)) {
    return value as CompetitionStatus;
  }
  return "draft";
}

export function parseCompetitionVisibility(value: unknown): CompetitionVisibility {
  if (
    typeof value === "string" &&
    COMPETITION_VISIBILITIES.includes(value as CompetitionVisibility)
  ) {
    return value as CompetitionVisibility;
  }
  return "public";
}

export function parseCompetitionTab(value: string | null | undefined): CompetitionUserTab {
  if (value && COMPETITION_USER_TABS.includes(value as CompetitionUserTab)) {
    return value as CompetitionUserTab;
  }
  return "live";
}

export function parseRoleKeys(raw: unknown): CompetitionRoleKey[] {
  if (!Array.isArray(raw)) return ["user"];
  const keys = raw
    .map((v) => {
      if (typeof v === "number") {
        const entry = Object.entries(COMPETITION_ROLE_IDS).find(([, id]) => id === v);
        return entry?.[0] as CompetitionRoleKey | undefined;
      }
      if (typeof v === "string" && COMPETITION_ROLE_KEYS.includes(v as CompetitionRoleKey)) {
        return v as CompetitionRoleKey;
      }
      return null;
    })
    .filter((v): v is CompetitionRoleKey => v != null);
  return keys.length > 0 ? keys : ["user"];
}

export function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t).trim()).filter(Boolean);
}

export function parseOptions(raw: unknown): { label: string; sortOrder: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (typeof item === "string") {
        const label = item.trim();
        return label ? { label, sortOrder: index } : null;
      }
      if (item && typeof item === "object") {
        const b = item as Record<string, unknown>;
        const label = String(b.label ?? "").trim();
        if (!label) return null;
        const sortOrder = Number(b.sortOrder ?? b.sort_order ?? index);
        return { label, sortOrder: Number.isFinite(sortOrder) ? sortOrder : index };
      }
      return null;
    })
    .filter((v): v is { label: string; sortOrder: number } => v != null);
}

export function getParticipationStart(c: Pick<Competition, "participationStartDate" | "startDate">) {
  return c.participationStartDate ?? c.startDate;
}

export function getParticipationEnd(c: Pick<Competition, "participationEndDate" | "endDate">) {
  return c.participationEndDate ?? c.endDate;
}

export function computeTimeLeft(endDate: Date): { days: number; hours: number; label: string } | null {
  const now = new Date();
  const end = new Date(endDate);
  if (end <= now) return null;
  const diffMs = end.getTime() - now.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const label =
    days > 0 ? `${days} Day${days === 1 ? "" : "s"} ${hours} Hour${hours === 1 ? "" : "s"}` : `${hours} Hour${hours === 1 ? "" : "s"}`;
  return { days, hours, label };
}

export function deriveEffectiveStatus(
  c: Pick<
    Competition,
    | "status"
    | "startDate"
    | "endDate"
    | "participationStartDate"
    | "participationEndDate"
    | "resultDeclaredAt"
  >,
): CompetitionStatus {
  if (c.status === "cancelled" || c.status === "draft") return c.status;
  if (c.status === "completed" || c.resultDeclaredAt) return "completed";

  const now = new Date();
  const partStart = getParticipationStart(c);
  const partEnd = getParticipationEnd(c);

  if (now < partStart) return "upcoming";
  if (now > c.endDate) return "completed";
  if (now <= partEnd || now <= c.endDate) return "live";
  return "completed";
}

export function isParticipationOpen(
  c: Pick<
    Competition,
    | "status"
    | "participationStartDate"
    | "participationEndDate"
    | "startDate"
    | "endDate"
    | "resultDeclaredAt"
  >,
): boolean {
  if (c.status === "cancelled" || c.status === "draft" || c.resultDeclaredAt) return false;
  const now = new Date();
  const partStart = getParticipationStart(c);
  const partEnd = getParticipationEnd(c);
  return now >= partStart && now <= partEnd;
}

export function serializeRole(role: CompetitionRole) {
  return {
    id: role.id,
    competitionId: role.competitionId,
    roleId: COMPETITION_ROLE_IDS[role.roleKey],
    roleKey: role.roleKey,
    roleLabel: COMPETITION_ROLE_LABELS[role.roleKey],
  };
}

export function serializeOption(option: CompetitionOption) {
  return {
    id: option.id,
    competitionId: option.competitionId,
    label: option.label,
    sortOrder: option.sortOrder,
  };
}

export function serializePrediction(
  p: CompetitionPrediction & { option?: CompetitionOption | null },
) {
  return {
    id: p.id,
    competitionId: p.competitionId,
    userId: p.userId,
    optionId: p.optionId,
    optionLabel: p.option?.label ?? null,
    isCorrect: p.isCorrect,
    pointsEarned: p.pointsEarned,
    submittedAt: p.submittedAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeCompetition(
  c: CompetitionWithRelations,
  opts?: {
    joined?: boolean;
    hasPrediction?: boolean;
    userPrediction?: (CompetitionPrediction & { option?: CompetitionOption | null }) | null;
  },
) {
  const participantCount = c._count?.predictions ?? c._count?.participants ?? 0;
  const effectiveStatus = deriveEffectiveStatus(c);
  const participationEnd = getParticipationEnd(c);
  const participationTimeLeft =
    effectiveStatus === "live" || effectiveStatus === "upcoming"
      ? computeTimeLeft(participationEnd)
      : null;

  return {
    id: c.id,
    title: c.title,
    shortDescription: c.shortDescription,
    description: c.description,
    bannerImage: c.bannerImage,
    tags: c.tags ?? [],
    question: c.question,
    participationStartDate: getParticipationStart(c).toISOString(),
    participationEndDate: participationEnd.toISOString(),
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    status: c.status,
    effectiveStatus,
    participationOpen: isParticipationOpen(c),
    visibility: c.visibility,
    visibilityLabel: COMPETITION_VISIBILITY_LABELS[c.visibility],
    reputationPoints: c.reputationPoints,
    wrongPredictionPoints: c.wrongPredictionPoints,
    maxPredictionsPerUser: c.maxPredictionsPerUser,
    allowPredictionChange: c.allowPredictionChange,
    requireLogin: c.requireLogin,
    entryType: c.entryType,
    entryFee: toNumber(c.entryFee),
    prizePool: toNumber(c.prizePool),
    totalWinners: c.totalWinners,
    maxParticipants: c.maxParticipants,
    participantCount,
    participationTimeLeft,
    daysLeft: participationTimeLeft?.days ?? null,
    joined: opts?.joined ?? opts?.hasPrediction ?? false,
    hasPrediction: opts?.hasPrediction ?? false,
    userPrediction: opts?.userPrediction ? serializePrediction(opts.userPrediction) : null,
    winningOptionId: c.winningOptionId,
    winningOptionLabel: c.winningOption?.label ?? null,
    resultDeclaredAt: c.resultDeclaredAt?.toISOString() ?? null,
    allowedRoles: (c.allowedRoles ?? []).map(serializeRole),
    options: (c.options ?? []).map(serializeOption),
    createdBy: c.createdBy
      ? { id: c.createdBy.id, fullName: c.createdBy.fullName, email: c.createdBy.email }
      : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function serializeParticipant(p: CompetitionParticipant & { user: User }) {
  return {
    id: p.id,
    competitionId: p.competitionId,
    userId: p.userId,
    userName: p.user.fullName,
    email: p.user.email,
    roleKey: p.roleKey,
    roleLabel: COMPETITION_ROLE_LABELS[p.roleKey],
    status: p.status,
    joinedAt: p.joinedAt.toISOString(),
  };
}

export function serializeLeaderboardEntry(
  e: CompetitionLeaderboard & {
    user?: {
      fullName?: string | null;
      advisorProfile?: { profileImageUrl: string | null } | null;
    } | null;
  },
) {
  const reputationPoints = toNumber(e.points) ?? 0;
  return {
    id: e.id,
    competitionId: e.competitionId,
    userId: e.userId,
    userName: e.user?.fullName ?? "Unknown User",
    profileImage: e.user?.advisorProfile?.profileImageUrl ?? null,
    reputationPoints,
    points: reputationPoints,
    rank: e.rank,
    updatedAt: e.updatedAt.toISOString(),
  };
}

export type OptionInput = { label: string; sortOrder?: number };

export type CompetitionCreateInput = {
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  bannerImage?: string | null;
  tags?: string[];
  question?: string | null;
  options?: OptionInput[];
  participationStartDate?: Date | null;
  participationEndDate?: Date | null;
  startDate: Date;
  endDate: Date;
  status?: CompetitionStatus;
  visibility?: CompetitionVisibility;
  reputationPoints?: number;
  wrongPredictionPoints?: number;
  maxPredictionsPerUser?: number;
  allowPredictionChange?: boolean;
  requireLogin?: boolean;
  entryType?: CompetitionEntryType;
  entryFee?: number;
  maxParticipants?: number | null;
  allowedRoles?: CompetitionRoleKey[];
  createdById?: number;
};

export function validateCompetitionInput(input: CompetitionCreateInput): string | null {
  if (!input.title.trim()) return "Competition name is required";
  if (!input.question?.trim()) return "Prediction question is required";
  if (!input.options || input.options.length < 2) return "At least two answer options are required";

  const partStart = input.participationStartDate ?? input.startDate;
  const partEnd = input.participationEndDate ?? input.endDate;
  if (partEnd <= partStart) return "Participation end must be after participation start";
  if (input.endDate <= input.startDate) return "Competition end must be after competition start";
  if (partEnd > input.endDate) return "Participation cannot end after competition ends";

  if (input.maxParticipants != null && input.maxParticipants < 1) {
    return "maxParticipants must be at least 1";
  }
  if ((input.reputationPoints ?? 10) < 0) return "Reputation points cannot be negative";
  return null;
}

export const COMPETITION_API_DOCS = {
  user: {
    list: "GET /api/v1/competitions?tab=live|upcoming|completed|my",
    detail: "GET /api/v1/competitions/:id",
    predict: "POST /api/v1/competitions/:id/predict",
    leaderboard: "GET /api/v1/competitions/:id/leaderboard",
    myPredictions: "GET /api/v1/my-predictions",
    my: "GET /api/v1/my-competitions?tab=live|upcoming|completed",
  },
  admin: {
    list: "GET /api/v1/admin/competitions",
    create: "POST /api/v1/admin/competitions",
    detail: "GET /api/v1/admin/competitions/:id",
    declareWinner: "POST /api/v1/admin/competitions/:id/declare-winner",
    participants: "GET /api/v1/admin/competitions/participants?competition_id=",
    leaderboard: "GET /api/v1/admin/competitions/leaderboard?competition_id=",
  },
} as const;

export type UserCompetitionContext = {
  authRole: UserRole;
  isAnalyst: boolean;
  isCreator: boolean;
  isFinancialProfessional: boolean;
};

export function resolveEligibleRoleKeys(ctx: UserCompetitionContext): CompetitionRoleKey[] {
  const keys: CompetitionRoleKey[] = [];
  if (ctx.authRole === "user" || ctx.authRole === "admin" || ctx.authRole === "super_admin") {
    keys.push("user");
  }
  if (ctx.authRole === "advisor" || ctx.isFinancialProfessional) keys.push("advisor");
  if (ctx.isAnalyst) keys.push("analyst");
  if (ctx.isCreator) keys.push("creator");
  return keys;
}

export function isRoleEligible(
  allowed: CompetitionRoleKey[],
  userKeys: CompetitionRoleKey[],
): boolean {
  if (allowed.includes("all")) return true;
  return userKeys.some((k) => allowed.includes(k));
}

export function pickParticipantRoleKey(
  allowed: CompetitionRoleKey[],
  userKeys: CompetitionRoleKey[],
): CompetitionRoleKey {
  if (allowed.includes("all")) {
    return userKeys[0] ?? "user";
  }
  const match = userKeys.find((k) => allowed.includes(k));
  return match ?? "user";
}

export function canUserAccessCompetition(
  visibility: CompetitionVisibility,
  ctx: UserCompetitionContext,
): boolean {
  if (visibility === "public" || visibility === "hidden") return visibility === "public";
  if (visibility === "pro_members") return true;
  if (visibility === "financial_professionals") {
    return ctx.authRole === "advisor" || ctx.isFinancialProfessional;
  }
  return false;
}

export function serializeMyPredictionRow(row: {
  competition: CompetitionWithRelations;
  prediction: CompetitionPrediction & { option: CompetitionOption };
}) {
  const c = serializeCompetition(row.competition, {
    hasPrediction: true,
    userPrediction: row.prediction,
  });
  let predictionStatus = "Live";
  if (row.competition.resultDeclaredAt) {
    predictionStatus = row.prediction.isCorrect ? "Won" : "Lost";
  } else if (deriveEffectiveStatus(row.competition) === "completed") {
    predictionStatus = "Completed";
  } else if (deriveEffectiveStatus(row.competition) === "upcoming") {
    predictionStatus = "Upcoming";
  }
  return {
    ...c,
    predictionStatus,
    predictionLabel: row.prediction.option.label,
    pointsEarned: row.prediction.pointsEarned,
  };
}

export { getFinuerLevel, getPredictionAccuracy };
