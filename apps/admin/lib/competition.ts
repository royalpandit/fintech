import { Prisma } from "@prisma/client";
import type {
  Competition,
  CompetitionLeaderboard,
  CompetitionParticipant,
  CompetitionPrize,
  CompetitionRole,
  CompetitionWinner,
  User,
} from "@prisma/client";
import type { UserRole } from "@/lib/auth";

type Decimal = Prisma.Decimal;

export const COMPETITION_STATUSES = ["upcoming", "live", "completed", "cancelled"] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const COMPETITION_VISIBILITIES = ["public", "hidden"] as const;
export type CompetitionVisibility = (typeof COMPETITION_VISIBILITIES)[number];

export const COMPETITION_ENTRY_TYPES = ["free", "paid"] as const;
export type CompetitionEntryType = (typeof COMPETITION_ENTRY_TYPES)[number];

export const COMPETITION_ROLE_KEYS = ["user", "advisor", "creator", "analyst", "all"] as const;
export type CompetitionRoleKey = (typeof COMPETITION_ROLE_KEYS)[number];

/** Static role_id mapping for API docs (competition_roles.role_id) */
export const COMPETITION_ROLE_IDS: Record<CompetitionRoleKey, number> = {
  user: 1,
  advisor: 2,
  creator: 3,
  analyst: 4,
  all: 5,
};

export const COMPETITION_REWARD_TYPES = [
  "cash",
  "coin",
  "premium_subscription",
  "coupon",
] as const;
export type CompetitionRewardType = (typeof COMPETITION_REWARD_TYPES)[number];

export const COMPETITION_REWARD_LABELS: Record<CompetitionRewardType, string> = {
  cash: "Cash",
  coin: "Coin",
  premium_subscription: "Premium Subscription",
  coupon: "Coupon",
};

export const COMPETITION_ROLE_LABELS: Record<CompetitionRoleKey, string> = {
  user: "User",
  advisor: "Advisor",
  creator: "Creator",
  analyst: "Analyst",
  all: "All Roles",
};

export const COMPETITION_USER_TABS = ["live", "upcoming", "completed", "my"] as const;
export type CompetitionUserTab = (typeof COMPETITION_USER_TABS)[number];

export type CompetitionWithRelations = Competition & {
  allowedRoles?: CompetitionRole[];
  prizes?: CompetitionPrize[];
  createdBy?: Pick<User, "id" | "fullName" | "email"> | null;
  _count?: { participants: number };
};

export type CompetitionDetail = CompetitionWithRelations & {
  participantCount: number;
  daysLeft: number | null;
  joined?: boolean;
  rules?: string;
};

export function toNumber(value: Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : Number(value);
}

export function formatINR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatRewardValue(rewardType: CompetitionRewardType, value: string): string {
  if (rewardType === "cash") {
    const n = Number(value.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n)) return formatINR(n);
  }
  return value;
}

export function parseCompetitionStatus(value: unknown): CompetitionStatus {
  if (typeof value === "string" && COMPETITION_STATUSES.includes(value as CompetitionStatus)) {
    return value as CompetitionStatus;
  }
  return "upcoming";
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

export function computeDaysLeft(endDate: Date): number | null {
  const now = new Date();
  const end = new Date(endDate);
  if (end <= now) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function deriveEffectiveStatus(
  status: CompetitionStatus,
  startDate: Date,
  endDate: Date,
): CompetitionStatus {
  if (status === "cancelled" || status === "completed") return status;
  const now = new Date();
  if (now < startDate) return "upcoming";
  if (now > endDate) return "completed";
  return "live";
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

export function serializePrize(prize: CompetitionPrize) {
  return {
    id: prize.id,
    competitionId: prize.competitionId,
    fromRank: prize.fromRank,
    toRank: prize.toRank,
    rewardType: prize.rewardType,
    rewardTypeLabel: COMPETITION_REWARD_LABELS[prize.rewardType],
    rewardValue: prize.rewardValue,
    displayValue: formatRewardValue(prize.rewardType, prize.rewardValue),
    rankLabel:
      prize.fromRank === prize.toRank
        ? `Rank ${prize.fromRank}`
        : `Rank ${prize.fromRank}–${prize.toRank}`,
  };
}

export function serializeCompetition(
  c: CompetitionWithRelations,
  opts?: { joined?: boolean; userId?: number },
) {
  const participantCount = c._count?.participants ?? 0;
  const effectiveStatus = deriveEffectiveStatus(c.status, c.startDate, c.endDate);
  const daysLeft =
    effectiveStatus === "live" || effectiveStatus === "upcoming"
      ? computeDaysLeft(c.endDate)
      : null;

  return {
    id: c.id,
    title: c.title,
    shortDescription: c.shortDescription,
    description: c.description,
    bannerImage: c.bannerImage,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    status: c.status,
    effectiveStatus,
    visibility: c.visibility,
    entryType: c.entryType,
    entryFee: toNumber(c.entryFee),
    prizePool: toNumber(c.prizePool),
    totalWinners: c.totalWinners,
    maxParticipants: c.maxParticipants,
    participantCount,
    daysLeft,
    joined: opts?.joined ?? false,
    allowedRoles: (c.allowedRoles ?? []).map(serializeRole),
    prizes: (c.prizes ?? []).map(serializePrize),
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
    user: {
      id: number;
      fullName: string;
      email: string;
      role: User["role"];
      advisorProfile?: { profileImageUrl: string | null } | null;
    } | null;
  },
) {
  const portfolioValue = toNumber(e.portfolioValue) ?? toNumber(e.points);
  const totalReturn = toNumber(e.totalReturn) ?? toNumber(e.score);
  return {
    id: e.id,
    competitionId: e.competitionId,
    userId: e.userId,
    userName: e.user?.fullName ?? "Unknown User",
    profileImage: e.user?.advisorProfile?.profileImageUrl ?? null,
    portfolioValue,
    totalReturn,
    points: portfolioValue,
    score: totalReturn,
    rank: e.rank,
    updatedAt: e.updatedAt.toISOString(),
  };
}

export function serializeWinner(
  w: CompetitionWinner & {
    user: { id: number; fullName: string; email: string } | null;
  },
) {
  return {
    id: w.id,
    competitionId: w.competitionId,
    userId: w.userId,
    userName: w.user.fullName,
    rank: w.rank,
    rewardType: w.rewardType,
    rewardTypeLabel: COMPETITION_REWARD_LABELS[w.rewardType],
    rewardValue: w.rewardValue,
    displayValue: formatRewardValue(w.rewardType, w.rewardValue),
    distributed: w.distributed,
  };
}

export type PrizeInput = {
  fromRank: number;
  toRank: number;
  rewardType: CompetitionRewardType;
  rewardValue: string;
};

export function normalizePrizeInput(raw: unknown): PrizeInput | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const fromRank = Number(b.fromRank ?? b.from_rank);
  const toRank = Number(b.toRank ?? b.to_rank);
  const rewardType = String(b.rewardType ?? b.reward_type ?? "cash");
  const rewardValue = String(b.rewardValue ?? b.reward_value ?? "").trim();
  if (!Number.isFinite(fromRank) || !Number.isFinite(toRank) || !rewardValue) return null;
  if (!COMPETITION_REWARD_TYPES.includes(rewardType as CompetitionRewardType)) return null;
  return {
    fromRank,
    toRank,
    rewardType: rewardType as CompetitionRewardType,
    rewardValue,
  };
}

export type CompetitionCreateInput = {
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  bannerImage?: string | null;
  startDate: Date;
  endDate: Date;
  status?: CompetitionStatus;
  visibility?: CompetitionVisibility;
  entryType?: CompetitionEntryType;
  entryFee?: number;
  prizePool?: number;
  totalWinners?: number;
  maxParticipants?: number | null;
  allowedRoles?: CompetitionRoleKey[];
  prizes?: PrizeInput[];
  createdById?: number;
};

export function validateCompetitionInput(input: CompetitionCreateInput): string | null {
  if (!input.title.trim()) return "title is required";
  if (input.endDate <= input.startDate) return "endDate must be after startDate";
  if (input.entryType === "paid" && (input.entryFee ?? 0) <= 0) {
    return "entryFee is required for paid competitions";
  }
  if (input.maxParticipants != null && input.maxParticipants < 1) {
    return "maxParticipants must be at least 1";
  }
  return null;
}

export const COMPETITION_API_DOCS = {
  user: {
    list: "GET /api/v1/competitions?tab=live|upcoming|completed",
    detail: "GET /api/v1/competitions/:id",
    join: "POST /api/v1/competitions/:id/join",
    leaderboard: "GET /api/v1/competitions/:id/leaderboard",
    my: "GET /api/v1/my-competitions?tab=live|upcoming|completed",
    winners: "GET /api/v1/competition-winners?competition_id=",
  },
  admin: {
    list: "GET /api/v1/admin/competitions",
    create: "POST /api/v1/admin/competitions",
    detail: "GET /api/v1/admin/competitions/:id",
    participants: "GET /api/v1/admin/competitions/participants?competition_id=&search=&page=",
    leaderboard: "GET /api/v1/admin/competitions/leaderboard?competition_id=",
    winners: "GET /api/v1/admin/competitions/winners?competition_id=",
    prizes: "POST /api/v1/admin/competitions/:id/prizes",
  },
} as const;

/** Map auth UserRole + profile to competition role keys for eligibility */
export type UserCompetitionContext = {
  authRole: UserRole;
  isAnalyst: boolean;
  isCreator: boolean;
};

export function resolveEligibleRoleKeys(ctx: UserCompetitionContext): CompetitionRoleKey[] {
  const keys: CompetitionRoleKey[] = [];
  if (ctx.authRole === "user" || ctx.authRole === "admin" || ctx.authRole === "super_admin") {
    keys.push("user");
  }
  if (ctx.authRole === "advisor") keys.push("advisor");
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
