import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/auth";
import {
  deriveEffectiveStatus,
  isRoleEligible,
  pickParticipantRoleKey,
  resolveEligibleRoleKeys,
  type CompetitionCreateInput,
  type CompetitionRoleKey,
  type CompetitionStatus,
  type CompetitionUserTab,
  type CompetitionVisibility,
  type PrizeInput,
} from "@/lib/competition";
import { competitionTradingRepository } from "@/lib/competition-trading-repository";

const competitionIncludeList = {
  allowedRoles: true,
  prizes: { orderBy: { fromRank: "asc" as const } },
  createdBy: { select: { id: true, fullName: true, email: true } },
  _count: { select: { participants: { where: { status: "active" } } } },
} satisfies Prisma.CompetitionInclude;

const competitionIncludeDetail = {
  ...competitionIncludeList,
} satisfies Prisma.CompetitionInclude;

const leaderboardUserInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      advisorProfile: { select: { profileImageUrl: true } },
    },
  },
} satisfies Prisma.CompetitionLeaderboardInclude;

export type CompetitionListFilters = {
  status?: CompetitionStatus | null;
  visibility?: CompetitionVisibility | null;
  tab?: CompetitionUserTab | null;
  userId?: number | null;
  publicOnly?: boolean;
  search?: string | null;
};

export class CompetitionRepository {
  async getUserCompetitionContext(userId: number, authRole: UserRole) {
    const needsAdvisorProfile = authRole === "advisor";

    const [advisorProfile, basketCount, postCount, groupCount] = await Promise.all([
      needsAdvisorProfile
        ? prisma.advisorProfile.findUnique({
            where: { userId },
            select: { professionalType: true },
          })
        : Promise.resolve(null),
      prisma.finuerBasket.count({ where: { createdById: userId } }),
      prisma.communityPost.count({ where: { userId } }),
      prisma.stockPickGroup.count({ where: { createdById: userId } }),
    ]);

    return {
      authRole,
      isAnalyst: advisorProfile?.professionalType === "research_analyst",
      isCreator: basketCount + postCount + groupCount > 0,
    };
  }

  private buildWhere(filters: CompetitionListFilters): Prisma.CompetitionWhereInput {
    const where: Prisma.CompetitionWhereInput = {};

    if (filters.publicOnly) {
      where.visibility = "public";
      where.status = { not: "cancelled" };
    }

    if (filters.visibility) where.visibility = filters.visibility;
    if (filters.status) where.status = filters.status;

    if (filters.search?.trim()) {
      where.OR = [
        { title: { contains: filters.search.trim(), mode: "insensitive" } },
        { shortDescription: { contains: filters.search.trim(), mode: "insensitive" } },
      ];
    }

    if (filters.tab === "my" && filters.userId) {
      where.participants = { some: { userId: filters.userId, status: "active" } };
    } else if (filters.tab === "live") {
      where.startDate = { lte: new Date() };
      where.endDate = { gte: new Date() };
      where.status = { not: "cancelled" };
    } else if (filters.tab === "upcoming") {
      where.startDate = { gt: new Date() };
      where.status = { notIn: ["cancelled", "completed"] };
    } else if (filters.tab === "completed") {
      where.OR = [
        { status: "completed" },
        { endDate: { lt: new Date() }, status: { not: "cancelled" } },
      ];
    }

    return where;
  }

  listCompetitions(filters: CompetitionListFilters = {}) {
    return prisma.competition.findMany({
      where: this.buildWhere(filters),
      include: competitionIncludeList,
      orderBy: [{ startDate: "desc" }],
    });
  }

  findCompetitionById(id: number) {
    return prisma.competition.findUnique({
      where: { id },
      include: competitionIncludeDetail,
    });
  }

  async hasJoined(competitionId: number, userId: number) {
    const row = await prisma.competitionParticipant.findUnique({
      where: { competitionId_userId: { competitionId, userId } },
    });
    return row?.status === "active";
  }

  async createCompetition(input: CompetitionCreateInput) {
    const allowedRoles = input.allowedRoles?.length ? input.allowedRoles : (["user"] as CompetitionRoleKey[]);
    const roleData =
      allowedRoles.includes("all")
        ? [{ roleKey: "all" as const }]
        : allowedRoles.map((roleKey) => ({ roleKey }));

    return prisma.competition.create({
      data: {
        title: input.title.trim(),
        shortDescription: input.shortDescription?.trim() || null,
        description: input.description?.trim() || null,
        bannerImage: input.bannerImage?.trim() || null,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status ?? "upcoming",
        visibility: input.visibility ?? "public",
        entryType: input.entryType ?? "free",
        entryFee: input.entryFee ?? 0,
        prizePool: input.prizePool ?? 0,
        totalWinners: input.totalWinners ?? 0,
        maxParticipants: input.maxParticipants ?? null,
        createdById: input.createdById ?? null,
        allowedRoles: { create: roleData },
        prizes: input.prizes?.length
          ? {
              create: input.prizes.map((p) => ({
                fromRank: p.fromRank,
                toRank: p.toRank,
                rewardType: p.rewardType,
                rewardValue: p.rewardValue,
              })),
            }
          : undefined,
      },
      include: competitionIncludeDetail,
    });
  }

  async updateCompetition(id: number, input: Partial<CompetitionCreateInput>) {
    if (input.allowedRoles) {
      await prisma.competitionRole.deleteMany({ where: { competitionId: id } });
      const roleData = input.allowedRoles.includes("all")
        ? [{ competitionId: id, roleKey: "all" as const }]
        : input.allowedRoles.map((roleKey) => ({ competitionId: id, roleKey }));
      await prisma.competitionRole.createMany({ data: roleData });
    }

    return prisma.competition.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.shortDescription !== undefined
          ? { shortDescription: input.shortDescription?.trim() || null }
          : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.bannerImage !== undefined ? { bannerImage: input.bannerImage?.trim() || null } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.entryType !== undefined ? { entryType: input.entryType } : {}),
        ...(input.entryFee !== undefined ? { entryFee: input.entryFee } : {}),
        ...(input.prizePool !== undefined ? { prizePool: input.prizePool } : {}),
        ...(input.totalWinners !== undefined ? { totalWinners: input.totalWinners } : {}),
        ...(input.maxParticipants !== undefined ? { maxParticipants: input.maxParticipants } : {}),
      },
      include: competitionIncludeDetail,
    });
  }

  async deleteCompetition(id: number) {
    return prisma.competition.delete({ where: { id } });
  }

  async setVisibility(id: number, visibility: CompetitionVisibility) {
    return prisma.competition.update({
      where: { id },
      data: { visibility },
      include: competitionIncludeDetail,
    });
  }

  async setStatus(id: number, status: CompetitionStatus) {
    return prisma.competition.update({
      where: { id },
      data: { status },
      include: competitionIncludeDetail,
    });
  }

  // ─── Prizes ────────────────────────────────────────────

  listPrizes(competitionId: number) {
    return prisma.competitionPrize.findMany({
      where: { competitionId },
      orderBy: { fromRank: "asc" },
    });
  }

  async replacePrizes(competitionId: number, prizes: PrizeInput[]) {
    await prisma.competitionPrize.deleteMany({ where: { competitionId } });
    if (prizes.length === 0) return [];
    await prisma.competitionPrize.createMany({
      data: prizes.map((p) => ({
        competitionId,
        fromRank: p.fromRank,
        toRank: p.toRank,
        rewardType: p.rewardType,
        rewardValue: p.rewardValue,
      })),
    });
    return this.listPrizes(competitionId);
  }

  // ─── Participants ──────────────────────────────────────

  listParticipants(opts: {
    competitionId?: number | null;
    search?: string | null;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where: Prisma.CompetitionParticipantWhereInput = {};
    if (opts.competitionId) where.competitionId = opts.competitionId;
    if (opts.search?.trim()) {
      where.user = {
        OR: [
          { fullName: { contains: opts.search.trim(), mode: "insensitive" } },
          { email: { contains: opts.search.trim(), mode: "insensitive" } },
        ],
      };
    }

    return prisma.$transaction([
      prisma.competitionParticipant.findMany({
        where,
        include: { user: true, competition: { select: { id: true, title: true } } },
        orderBy: { joinedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.competitionParticipant.count({ where }),
    ]);
  }

  async joinCompetition(competitionId: number, userId: number, authRole: UserRole) {
    const competition = await this.findCompetitionById(competitionId);
    if (!competition) throw new Error("Competition not found");
    if (competition.visibility !== "public") throw new Error("Competition is not available");
    if (competition.status === "cancelled") throw new Error("Competition has been cancelled");

    const effective = deriveEffectiveStatus(
      competition.status,
      competition.startDate,
      competition.endDate,
    );
    if (effective === "completed") throw new Error("Competition has ended");

    const existing = await prisma.competitionParticipant.findUnique({
      where: { competitionId_userId: { competitionId, userId } },
    });
    if (existing?.status === "active") throw new Error("You have already joined this competition");

    const activeCount = await prisma.competitionParticipant.count({
      where: { competitionId, status: "active" },
    });
    if (competition.maxParticipants != null && activeCount >= competition.maxParticipants) {
      throw new Error("Maximum participants reached");
    }

    const ctx = await this.getUserCompetitionContext(userId, authRole);
    const userKeys = resolveEligibleRoleKeys(ctx);
    const allowed = competition.allowedRoles.map((r) => r.roleKey);
    if (!isRoleEligible(allowed, userKeys)) {
      throw new Error("Your role is not eligible for this competition");
    }

    const roleKey = pickParticipantRoleKey(allowed, userKeys);

    const participant = await prisma.competitionParticipant.upsert({
      where: { competitionId_userId: { competitionId, userId } },
      create: { competitionId, userId, roleKey, status: "active" },
      update: { roleKey, status: "active", joinedAt: new Date() },
    });

    const capital = 1_000_000;
    await prisma.competitionPortfolio.upsert({
      where: { competitionId_userId: { competitionId, userId } },
      create: {
        competitionId,
        userId,
        initialCapital: capital,
        cashBalance: capital,
        portfolioValue: capital,
        investedAmount: 0,
        totalReturn: 0,
        todayReturn: 0,
      },
      update: {},
    });

    await prisma.competitionLeaderboard.upsert({
      where: { competitionId_userId: { competitionId, userId } },
      create: {
        competitionId,
        userId,
        portfolioValue: capital,
        totalReturn: 0,
        points: capital,
        score: 0,
      },
      update: {},
    });

    return participant;
  }

  // ─── Leaderboard ───────────────────────────────────────

  listLeaderboard(competitionId: number, sortBy: "rank" | "points" | "score" | "return" = "rank") {
    const orderBy: Prisma.CompetitionLeaderboardOrderByWithRelationInput[] =
      sortBy === "points"
        ? [{ portfolioValue: "desc" }, { totalReturn: "desc" }]
        : sortBy === "score" || sortBy === "return"
          ? [{ totalReturn: "desc" }, { portfolioValue: "desc" }]
          : [{ rank: "asc" }];

    return prisma.competitionLeaderboard.findMany({
      where: { competitionId },
      include: leaderboardUserInclude,
      orderBy,
    });
  }

  async upsertLeaderboardEntry(
    competitionId: number,
    userId: number,
    data: { points?: number; score?: number },
  ) {
    return prisma.competitionLeaderboard.upsert({
      where: { competitionId_userId: { competitionId, userId } },
      create: {
        competitionId,
        userId,
        points: data.points ?? 0,
        score: data.score ?? 0,
      },
      update: {
        ...(data.points !== undefined ? { points: data.points } : {}),
        ...(data.score !== undefined ? { score: data.score } : {}),
      },
      include: leaderboardUserInclude,
    });
  }

  async recalculateRanks(competitionId: number) {
    const entries = await prisma.competitionLeaderboard.findMany({
      where: { competitionId },
      orderBy: [{ totalReturn: "desc" }, { portfolioValue: "desc" }, { updatedAt: "asc" }],
    });

    await prisma.$transaction(
      entries.map((e, i) =>
        prisma.competitionLeaderboard.update({
          where: { id: e.id },
          data: { rank: i + 1 },
        }),
      ),
    );

    return this.listLeaderboard(competitionId, "rank");
  }

  // ─── Winners ───────────────────────────────────────────

  listWinners(competitionId?: number | null) {
    return prisma.competitionWinner.findMany({
      where: competitionId ? { competitionId } : undefined,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        competition: { select: { id: true, title: true, visibility: true } },
      },
      orderBy: [{ competitionId: "desc" }, { rank: "asc" }],
    });
  }

  async listWinnersWithReturns(competitionId?: number | null) {
    const winners = await this.listWinners(competitionId);
    const lbMap = new Map<string, { totalReturn: number; portfolioValue: number }>();

    if (winners.length > 0) {
      const compIds = [...new Set(winners.map((w) => w.competitionId))];
      const lbRows = await prisma.competitionLeaderboard.findMany({
        where: { competitionId: { in: compIds } },
        select: { competitionId: true, userId: true, totalReturn: true, portfolioValue: true },
      });
      for (const row of lbRows) {
        lbMap.set(`${row.competitionId}-${row.userId}`, {
          totalReturn: Number(row.totalReturn),
          portfolioValue: Number(row.portfolioValue),
        });
      }
    }

    return winners.map((w) => {
      const lb = lbMap.get(`${w.competitionId}-${w.userId}`);
      return { winner: w, totalReturn: lb?.totalReturn ?? null, portfolioValue: lb?.portfolioValue ?? null };
    });
  }

  async syncWinnersFromLeaderboard(competitionId: number) {
    await competitionTradingRepository.refreshCompetitionPrices(competitionId);
    return competitionTradingRepository.generateWinners(competitionId).then(() =>
      this.listWinners(competitionId),
    );
  }

  async markWinnerDistributed(winnerId: number, distributed: boolean) {
    return prisma.competitionWinner.update({
      where: { id: winnerId },
      data: { distributed },
      include: { user: true, competition: { select: { id: true, title: true } } },
    });
  }

  parseListQuery(params: URLSearchParams): CompetitionListFilters {
    const tab = params.get("tab") as CompetitionUserTab | null;
    return {
      status: (params.get("status") as CompetitionStatus) || null,
      visibility: (params.get("visibility") as CompetitionVisibility) || null,
      tab: tab && ["live", "upcoming", "completed", "my"].includes(tab) ? tab : null,
      search: params.get("search"),
    };
  }
}

export const competitionRepository = new CompetitionRepository();
