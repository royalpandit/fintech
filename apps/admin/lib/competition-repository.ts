import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/auth";
import {
  deriveEffectiveStatus,
  getParticipationEnd,
  getParticipationStart,
  isParticipationOpen,
  isRoleEligible,
  pickParticipantRoleKey,
  resolveEligibleRoleKeys,
  canUserAccessCompetition,
  type CompetitionCreateInput,
  type CompetitionRoleKey,
  type CompetitionStatus,
  type CompetitionUserTab,
  type CompetitionVisibility,
  COMPETITION_USER_TABS,
} from "@/lib/competition";
import { serializePredictionStats } from "@/lib/competition-reputation";

const competitionIncludeList = {
  allowedRoles: true,
  options: { orderBy: { sortOrder: "asc" as const } },
  winningOption: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
  _count: { select: { predictions: true } },
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
  tag?: string | null;
};

export class CompetitionRepository {
  async getUserCompetitionContext(userId: number, authRole: UserRole) {
    const needsAdvisorProfile = authRole === "advisor";

    const [advisorProfile, basketCount, postCount, groupCount] = await Promise.all([
      needsAdvisorProfile
        ? prisma.advisorProfile.findUnique({
            where: { userId },
            select: { professionalType: true, verificationStatus: true },
          })
        : Promise.resolve(null),
      prisma.finuerBasket.count({ where: { createdById: userId } }),
      prisma.communityPost.count({ where: { userId } }),
      prisma.stockPickGroup.count({ where: { createdById: userId } }),
    ]);

    const isFinancialProfessional =
      authRole === "advisor" &&
      advisorProfile?.verificationStatus === "approved";

    return {
      authRole,
      isAnalyst: advisorProfile?.professionalType === "research_analyst",
      isCreator: basketCount + postCount + groupCount > 0,
      isFinancialProfessional,
    };
  }

  private buildWhere(filters: CompetitionListFilters): Prisma.CompetitionWhereInput {
    const where: Prisma.CompetitionWhereInput = {};

    if (filters.publicOnly) {
      where.visibility = { in: ["public", "pro_members", "financial_professionals"] };
      where.status = { notIn: ["cancelled", "draft"] };
    }

    if (filters.visibility) where.visibility = filters.visibility;
    if (filters.status) where.status = filters.status;

    if (filters.search?.trim()) {
      where.OR = [
        { title: { contains: filters.search.trim(), mode: "insensitive" } },
        { shortDescription: { contains: filters.search.trim(), mode: "insensitive" } },
        { question: { contains: filters.search.trim(), mode: "insensitive" } },
      ];
    }

    if (filters.tag?.trim()) {
      where.tags = { has: filters.tag.trim() };
    }

    const now = new Date();

    if (filters.tab === "my" && filters.userId) {
      where.predictions = { some: { userId: filters.userId } };
    } else if (filters.tab === "upcoming") {
      where.status = { notIn: ["cancelled", "draft", "completed"] };
      where.resultDeclaredAt = null;
      where.OR = [
        { participationStartDate: { gt: now } },
        {
          participationStartDate: null,
          startDate: { gt: now },
        },
      ];
    } else if (filters.tab === "completed") {
      where.OR = [
        { status: "completed" },
        { resultDeclaredAt: { not: null } },
        { endDate: { lt: now }, status: { not: "cancelled" } },
      ];
    } else if (filters.tab === "live") {
      where.status = { notIn: ["cancelled", "draft", "completed"] };
      where.resultDeclaredAt = null;
      where.endDate = { gte: now };
      where.OR = [
        {
          participationStartDate: { lte: now },
          participationEndDate: { gte: now },
        },
        {
          participationStartDate: null,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        {
          participationEndDate: { lt: now },
          endDate: { gte: now },
        },
      ];
    }

    return where;
  }

  listCompetitions(filters: CompetitionListFilters = {}) {
    return prisma.competition.findMany({
      where: this.buildWhere(filters),
      include: competitionIncludeList,
      orderBy: [{ participationEndDate: "asc" }, { startDate: "desc" }],
    });
  }

  findCompetitionById(id: number) {
    return prisma.competition.findUnique({
      where: { id },
      include: competitionIncludeDetail,
    });
  }

  async getUserPrediction(competitionId: number, userId: number) {
    return prisma.competitionPrediction.findUnique({
      where: { competitionId_userId: { competitionId, userId } },
      include: { option: true },
    });
  }

  async hasPrediction(competitionId: number, userId: number) {
    const row = await this.getUserPrediction(competitionId, userId);
    return Boolean(row);
  }

  async hasJoined(competitionId: number, userId: number) {
    return this.hasPrediction(competitionId, userId);
  }

  async createCompetition(input: CompetitionCreateInput) {
    const allowedRoles = input.allowedRoles?.length ? input.allowedRoles : (["user"] as CompetitionRoleKey[]);
    const roleData = allowedRoles.includes("all")
      ? [{ roleKey: "all" as const }]
      : allowedRoles.map((roleKey) => ({ roleKey }));

    return prisma.competition.create({
      data: {
        title: input.title.trim(),
        shortDescription: input.shortDescription?.trim() || null,
        description: input.description?.trim() || null,
        bannerImage: input.bannerImage?.trim() || null,
        tags: input.tags ?? [],
        question: input.question?.trim() || null,
        participationStartDate: input.participationStartDate ?? input.startDate,
        participationEndDate: input.participationEndDate ?? input.endDate,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status ?? "draft",
        visibility: input.visibility ?? "public",
        reputationPoints: input.reputationPoints ?? 10,
        wrongPredictionPoints: input.wrongPredictionPoints ?? 0,
        maxPredictionsPerUser: input.maxPredictionsPerUser ?? 1,
        allowPredictionChange: input.allowPredictionChange ?? false,
        requireLogin: input.requireLogin ?? true,
        entryType: input.entryType ?? "free",
        entryFee: input.entryFee ?? 0,
        maxParticipants: input.maxParticipants ?? null,
        createdById: input.createdById ?? null,
        allowedRoles: { create: roleData },
        options: input.options?.length
          ? {
              create: input.options.map((o, i) => ({
                label: o.label.trim(),
                sortOrder: o.sortOrder ?? i,
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

    if (input.options) {
      await prisma.competitionOption.deleteMany({ where: { competitionId: id } });
      if (input.options.length > 0) {
        await prisma.competitionOption.createMany({
          data: input.options.map((o, i) => ({
            competitionId: id,
            label: o.label.trim(),
            sortOrder: o.sortOrder ?? i,
          })),
        });
      }
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
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.question !== undefined ? { question: input.question?.trim() || null } : {}),
        ...(input.participationStartDate !== undefined
          ? { participationStartDate: input.participationStartDate }
          : {}),
        ...(input.participationEndDate !== undefined
          ? { participationEndDate: input.participationEndDate }
          : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.reputationPoints !== undefined ? { reputationPoints: input.reputationPoints } : {}),
        ...(input.wrongPredictionPoints !== undefined
          ? { wrongPredictionPoints: input.wrongPredictionPoints }
          : {}),
        ...(input.maxPredictionsPerUser !== undefined
          ? { maxPredictionsPerUser: input.maxPredictionsPerUser }
          : {}),
        ...(input.allowPredictionChange !== undefined
          ? { allowPredictionChange: input.allowPredictionChange }
          : {}),
        ...(input.requireLogin !== undefined ? { requireLogin: input.requireLogin } : {}),
        ...(input.entryType !== undefined ? { entryType: input.entryType } : {}),
        ...(input.entryFee !== undefined ? { entryFee: input.entryFee } : {}),
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

  listParticipants(opts: {
    competitionId?: number | null;
    search?: string | null;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where: Prisma.CompetitionPredictionWhereInput = {};
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
      prisma.competitionPrediction.findMany({
        where,
        include: {
          user: true,
          option: true,
          competition: { select: { id: true, title: true } },
        },
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.competitionPrediction.count({ where }),
    ]);
  }

  async submitPrediction(competitionId: number, userId: number, optionId: number, authRole: UserRole) {
    const competition = await this.findCompetitionById(competitionId);
    if (!competition) throw new Error("Competition not found");
    if (competition.status === "cancelled" || competition.status === "draft") {
      throw new Error("Competition is not available");
    }
    if (competition.resultDeclaredAt) throw new Error("Results have already been declared");

    const ctx = await this.getUserCompetitionContext(userId, authRole);
    if (!canUserAccessCompetition(competition.visibility, ctx)) {
      throw new Error("You are not eligible to participate in this competition");
    }

    if (!isParticipationOpen(competition)) {
      throw new Error("Participation window has closed");
    }

    const option = competition.options.find((o) => o.id === optionId);
    if (!option) throw new Error("Invalid answer option");

    const existing = await this.getUserPrediction(competitionId, userId);
    if (existing && !competition.allowPredictionChange) {
      throw new Error("You have already submitted a prediction");
    }

    const predictionCount = await prisma.competitionPrediction.count({
      where: { competitionId },
    });
    if (competition.maxParticipants != null && predictionCount >= competition.maxParticipants && !existing) {
      throw new Error("Maximum participants reached");
    }

    const allowed = competition.allowedRoles.map((r) => r.roleKey);
    const userKeys = resolveEligibleRoleKeys(ctx);
    if (!isRoleEligible(allowed, userKeys)) {
      throw new Error("Your role is not eligible for this competition");
    }

    const roleKey = pickParticipantRoleKey(allowed, userKeys);

    const prediction = await prisma.$transaction(async (tx) => {
      const saved = await tx.competitionPrediction.upsert({
        where: { competitionId_userId: { competitionId, userId } },
        create: { competitionId, userId, optionId },
        update: { optionId, updatedAt: new Date() },
        include: { option: true },
      });

      await tx.competitionParticipant.upsert({
        where: { competitionId_userId: { competitionId, userId } },
        create: { competitionId, userId, roleKey, status: "active" },
        update: { roleKey, status: "active" },
      });

      await tx.competitionLeaderboard.upsert({
        where: { competitionId_userId: { competitionId, userId } },
        create: {
          competitionId,
          userId,
          points: 0,
          score: 0,
          portfolioValue: 0,
          totalReturn: 0,
        },
        update: {},
      });

      return saved;
    });

    return prediction;
  }

  listLeaderboard(competitionId: number) {
    return prisma.competitionLeaderboard.findMany({
      where: { competitionId },
      include: leaderboardUserInclude,
      orderBy: [{ points: "desc" }, { updatedAt: "asc" }],
    });
  }

  async recalculateRanks(competitionId: number) {
    const entries = await prisma.competitionLeaderboard.findMany({
      where: { competitionId },
      orderBy: [{ points: "desc" }, { updatedAt: "asc" }],
    });

    await prisma.$transaction(
      entries.map((e, i) =>
        prisma.competitionLeaderboard.update({
          where: { id: e.id },
          data: { rank: i + 1 },
        }),
      ),
    );

    return this.listLeaderboard(competitionId);
  }

  async declareWinner(competitionId: number, winningOptionId: number) {
    const competition = await this.findCompetitionById(competitionId);
    if (!competition) throw new Error("Competition not found");
    if (competition.resultDeclaredAt) throw new Error("Winner already declared");

    const winningOption = competition.options.find((o) => o.id === winningOptionId);
    if (!winningOption) throw new Error("Invalid winning option");

    const predictions = await prisma.competitionPrediction.findMany({
      where: { competitionId },
      include: { option: true },
    });

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const prediction of predictions) {
        const won = prediction.optionId === winningOptionId;
        const pointsEarned = won
          ? competition.reputationPoints
          : competition.wrongPredictionPoints;

        await tx.competitionPrediction.update({
          where: { id: prediction.id },
          data: { isCorrect: won, pointsEarned },
        });

        await tx.competitionLeaderboard.upsert({
          where: { competitionId_userId: { competitionId, userId: prediction.userId } },
          create: {
            competitionId,
            userId: prediction.userId,
            points: pointsEarned,
            portfolioValue: pointsEarned,
            score: 0,
            totalReturn: 0,
          },
          update: { points: pointsEarned, portfolioValue: pointsEarned },
        });

        const stats = await tx.userPredictionStats.upsert({
          where: { userId: prediction.userId },
          create: { userId: prediction.userId },
          update: {},
        });
        const nextStreak = won ? stats.currentWinningStreak + 1 : 0;
        await tx.userPredictionStats.update({
          where: { userId: prediction.userId },
          data: {
            finuerScore: stats.finuerScore + pointsEarned,
            competitionsParticipated: stats.competitionsParticipated + 1,
            competitionsWon: stats.competitionsWon + (won ? 1 : 0),
            competitionsLost: stats.competitionsLost + (won ? 0 : 1),
            currentWinningStreak: nextStreak,
            bestWinningStreak: Math.max(stats.bestWinningStreak, nextStreak),
            lastCompetitionPlayedAt: now,
          },
        });
      }

      await tx.competition.update({
        where: { id: competitionId },
        data: {
          winningOptionId,
          resultDeclaredAt: now,
          status: "completed",
        },
      });
    });

    await this.recalculateRanks(competitionId);

    return this.findCompetitionById(competitionId);
  }

  async listMyPredictions(userId: number) {
    const rows = await prisma.competitionPrediction.findMany({
      where: { userId },
      include: {
        option: true,
        competition: { include: competitionIncludeList },
      },
      orderBy: { submittedAt: "desc" },
    });

    return rows.map((row) => ({
      prediction: row,
      competition: row.competition,
    }));
  }

  async getUserStats(userId: number) {
    const stats = await prisma.userPredictionStats.findUnique({ where: { userId } });
    if (!stats) {
      return serializePredictionStats({
        finuerScore: 0,
        competitionsParticipated: 0,
        competitionsWon: 0,
        competitionsLost: 0,
        currentWinningStreak: 0,
        bestWinningStreak: 0,
        lastCompetitionPlayedAt: null,
      });
    }
    return serializePredictionStats(stats);
  }

  parseListQuery(params: URLSearchParams): CompetitionListFilters {
    const tab = params.get("tab") as CompetitionUserTab | null;
    return {
      status: (params.get("status") as CompetitionStatus) || null,
      visibility: (params.get("visibility") as CompetitionVisibility) || null,
      tab: tab && COMPETITION_USER_TABS.includes(tab) ? tab : null,
      search: params.get("search"),
      tag: params.get("tag"),
    };
  }
}

export const competitionRepository = new CompetitionRepository();
