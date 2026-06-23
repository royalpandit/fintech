import { prisma } from "@/lib/prisma";
import { deriveEffectiveStatus } from "@/lib/competition";
import {
  COMPETITION_DEFAULT_INITIAL_CAPITAL,
  calcHoldingMetrics,
  calcTotalReturn,
  type BuySellInput,
} from "@/lib/competition-trading";
import { getLTP, searchSymbol, type QuoteInstrument } from "@/lib/angelone";

export class CompetitionTradingRepository {
  async getCompetitionOrThrow(competitionId: number) {
    const c = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!c) throw new Error("Competition not found");
    return c;
  }

  assertTradingAllowed(competition: { status: string; startDate: Date; endDate: Date }) {
    const effective = deriveEffectiveStatus(
      competition.status as "upcoming" | "live" | "completed" | "cancelled",
      competition.startDate,
      competition.endDate,
    );
    if (competition.status === "cancelled") throw new Error("Competition is cancelled");
    if (effective === "completed" || competition.status === "completed") {
      throw new Error("Competition has ended — trading is disabled");
    }
    if (effective !== "live") throw new Error("Competition is not live yet");
  }

  async assertJoined(competitionId: number, userId: number) {
    const p = await prisma.competitionParticipant.findUnique({
      where: { competitionId_userId: { competitionId, userId } },
    });
    if (!p || p.status !== "active") throw new Error("Join the competition first");
    return p;
  }

  async createPortfolio(competitionId: number, userId: number) {
    const capital = COMPETITION_DEFAULT_INITIAL_CAPITAL;
    return prisma.competitionPortfolio.upsert({
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
  }

  async getPortfolio(competitionId: number, userId: number) {
    let portfolio = await prisma.competitionPortfolio.findUnique({
      where: { competitionId_userId: { competitionId, userId } },
    });
    if (!portfolio) {
      const joined = await prisma.competitionParticipant.findUnique({
        where: { competitionId_userId: { competitionId, userId } },
      });
      if (joined?.status === "active") {
        portfolio = await this.createPortfolio(competitionId, userId);
      }
    }
    return portfolio;
  }

  private async fetchPrices(
    holdings: { stockSymbol: string; exchange: string; symbolToken: string | null; currentPrice: unknown }[],
  ): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    const withToken: QuoteInstrument[] = [];

    for (const h of holdings) {
      const sym = h.stockSymbol.toUpperCase();
      if (h.symbolToken) {
        withToken.push({
          exchange: h.exchange || "NSE",
          symboltoken: h.symbolToken,
          tradingSymbol: sym,
        });
      } else {
        prices[sym] = Number(h.currentPrice);
      }
    }

    if (withToken.length > 0) {
      try {
        const quotes = await getLTP(withToken);
        for (const q of quotes) {
          const sym = (q.tradingSymbol ?? "").toUpperCase();
          if (sym && q.ltp > 0) prices[sym] = q.ltp;
        }
      } catch {
        // fallback to stored prices
      }
    }

    for (const h of holdings) {
      const sym = h.stockSymbol.toUpperCase();
      if (!prices[sym]) prices[sym] = Number(h.currentPrice);
    }

    return prices;
  }

  async refreshUserPortfolio(competitionId: number, userId: number) {
    const portfolio = await this.getPortfolio(competitionId, userId);
    if (!portfolio) return null;

    const holdings = await prisma.competitionHolding.findMany({
      where: { competitionId, userId },
    });

    const priceMap = await this.fetchPrices(holdings);
    let investedAmount = 0;
    let holdingsValue = 0;
    let todayReturnSum = 0;

    for (const h of holdings) {
      const sym = h.stockSymbol.toUpperCase();
      const currentPrice = priceMap[sym] ?? Number(h.currentPrice);
      const metrics = calcHoldingMetrics(h.quantity, Number(h.avgBuyPrice), currentPrice);
      investedAmount += metrics.investedAmount;
      holdingsValue += metrics.marketValue;

      await prisma.competitionHolding.update({
        where: { id: h.id },
        data: {
          currentPrice,
          investedAmount: metrics.investedAmount,
          marketValue: metrics.marketValue,
          pnl: metrics.pnl,
          pnlPercentage: metrics.pnlPercentage,
        },
      });
    }

    const cashBalance = Number(portfolio.cashBalance);
    const portfolioValue = cashBalance + holdingsValue;
    const initialCapital = Number(portfolio.initialCapital);
    const totalReturn = calcTotalReturn(initialCapital, portfolioValue);

    const updated = await prisma.competitionPortfolio.update({
      where: { id: portfolio.id },
      data: {
        investedAmount,
        portfolioValue,
        totalReturn,
        todayReturn: todayReturnSum,
      },
    });

    await this.syncLeaderboardEntry(competitionId, userId, portfolioValue, totalReturn);
    return updated;
  }

  async refreshCompetitionPrices(competitionId: number) {
    const portfolios = await prisma.competitionPortfolio.findMany({
      where: { competitionId },
      select: { userId: true },
    });
    for (const p of portfolios) {
      await this.refreshUserPortfolio(competitionId, p.userId);
    }
    await this.recalculateRanks(competitionId);
  }

  private async syncLeaderboardEntry(
    competitionId: number,
    userId: number,
    portfolioValue: number,
    totalReturn: number,
  ) {
    await prisma.competitionLeaderboard.upsert({
      where: { competitionId_userId: { competitionId, userId } },
      create: {
        competitionId,
        userId,
        portfolioValue,
        totalReturn,
        points: portfolioValue,
        score: totalReturn,
      },
      update: {
        portfolioValue,
        totalReturn,
        points: portfolioValue,
        score: totalReturn,
      },
    });

    await prisma.competitionPortfolio.update({
      where: { competitionId_userId: { competitionId, userId } },
      data: { portfolioValue, totalReturn },
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

    await prisma.$transaction(
      entries.map((e, i) =>
        prisma.competitionPortfolio.updateMany({
          where: { competitionId, userId: e.userId },
          data: { rank: i + 1 },
        }),
      ),
    );
  }

  async resolvePrice(input: BuySellInput): Promise<number> {
    if (input.price > 0) return input.price;

    if (input.symbolToken) {
      try {
        const quotes = await getLTP([
          {
            exchange: input.exchange ?? "NSE",
            symboltoken: input.symbolToken,
            tradingSymbol: input.stockSymbol,
          },
        ]);
        if (quotes[0]?.ltp > 0) return quotes[0].ltp;
      } catch {
        /* use search fallback */
      }
    }

    const results = await searchSymbol(input.exchange ?? "NSE", input.stockSymbol);
    const match = results.find(
      (r) => r.tradingSymbol.toUpperCase() === input.stockSymbol.toUpperCase(),
    );
    if (match?.token) {
      const quotes = await getLTP([
        {
          exchange: match.exchange,
          symboltoken: match.token,
          tradingSymbol: match.tradingSymbol,
        },
      ]);
      if (quotes[0]?.ltp > 0) return quotes[0].ltp;
    }

    throw new Error("Unable to fetch stock price — provide price manually");
  }

  async buyStock(competitionId: number, userId: number, input: BuySellInput) {
    const competition = await this.getCompetitionOrThrow(competitionId);
    this.assertTradingAllowed(competition);
    await this.assertJoined(competitionId, userId);

    const symbol = input.stockSymbol.trim().toUpperCase();
    const qty = Math.floor(input.quantity);
    if (!symbol || qty <= 0) throw new Error("Invalid symbol or quantity");

    const price = await this.resolvePrice(input);
    const totalAmount = price * qty;

    const portfolio = await this.getPortfolio(competitionId, userId);
    if (!portfolio) throw new Error("Portfolio not found — rejoin competition");

    const cash = Number(portfolio.cashBalance);
    if (cash < totalAmount) {
      throw new Error(`Insufficient cash balance. Available: ₹${cash.toLocaleString("en-IN")}`);
    }

    const companyName = input.companyName.trim() || symbol;

    await prisma.$transaction(async (tx) => {
      await tx.competitionOrder.create({
        data: {
          competitionId,
          userId,
          stockSymbol: symbol,
          companyName,
          transactionType: "buy",
          quantity: qty,
          price,
          totalAmount,
        },
      });

      const existing = await tx.competitionHolding.findUnique({
        where: {
          competitionId_userId_stockSymbol: { competitionId, userId, stockSymbol: symbol },
        },
      });

      if (existing) {
        const newQty = existing.quantity + qty;
        const newAvg =
          (Number(existing.avgBuyPrice) * existing.quantity + price * qty) / newQty;
        const metrics = calcHoldingMetrics(newQty, newAvg, price);
        await tx.competitionHolding.update({
          where: { id: existing.id },
          data: {
            quantity: newQty,
            avgBuyPrice: newAvg,
            currentPrice: price,
            exchange: input.exchange ?? existing.exchange,
            symbolToken: input.symbolToken ?? existing.symbolToken,
            ...metrics,
          },
        });
      } else {
        const metrics = calcHoldingMetrics(qty, price, price);
        await tx.competitionHolding.create({
          data: {
            competitionId,
            userId,
            stockSymbol: symbol,
            companyName,
            exchange: input.exchange ?? "NSE",
            symbolToken: input.symbolToken ?? null,
            quantity: qty,
            avgBuyPrice: price,
            currentPrice: price,
            ...metrics,
          },
        });
      }

      await tx.competitionPortfolio.update({
        where: { id: portfolio.id },
        data: { cashBalance: cash - totalAmount },
      });
    });

    await this.refreshUserPortfolio(competitionId, userId);
    await this.recalculateRanks(competitionId);

    return this.getPortfolio(competitionId, userId);
  }

  async sellStock(competitionId: number, userId: number, input: BuySellInput) {
    const competition = await this.getCompetitionOrThrow(competitionId);
    this.assertTradingAllowed(competition);
    await this.assertJoined(competitionId, userId);

    const symbol = input.stockSymbol.trim().toUpperCase();
    const qty = Math.floor(input.quantity);
    if (!symbol || qty <= 0) throw new Error("Invalid symbol or quantity");

    const holding = await prisma.competitionHolding.findUnique({
      where: {
        competitionId_userId_stockSymbol: { competitionId, userId, stockSymbol: symbol },
      },
    });
    if (!holding || holding.quantity < qty) {
      throw new Error("Insufficient shares to sell");
    }

    const price = await this.resolvePrice({
      ...input,
      stockSymbol: symbol,
      exchange: input.exchange ?? holding.exchange,
      symbolToken: input.symbolToken ?? holding.symbolToken ?? undefined,
    });
    const totalAmount = price * qty;

    const portfolio = await this.getPortfolio(competitionId, userId);
    if (!portfolio) throw new Error("Portfolio not found");

    await prisma.$transaction(async (tx) => {
      await tx.competitionOrder.create({
        data: {
          competitionId,
          userId,
          stockSymbol: symbol,
          companyName: holding.companyName,
          transactionType: "sell",
          quantity: qty,
          price,
          totalAmount,
        },
      });

      const remaining = holding.quantity - qty;
      if (remaining <= 0) {
        await tx.competitionHolding.delete({ where: { id: holding.id } });
      } else {
        const metrics = calcHoldingMetrics(remaining, Number(holding.avgBuyPrice), price);
        await tx.competitionHolding.update({
          where: { id: holding.id },
          data: { quantity: remaining, currentPrice: price, ...metrics },
        });
      }

      await tx.competitionPortfolio.update({
        where: { id: portfolio.id },
        data: { cashBalance: Number(portfolio.cashBalance) + totalAmount },
      });
    });

    await this.refreshUserPortfolio(competitionId, userId);
    await this.recalculateRanks(competitionId);

    return this.getPortfolio(competitionId, userId);
  }

  listHoldings(competitionId: number, userId: number) {
    return prisma.competitionHolding.findMany({
      where: { competitionId, userId },
      orderBy: { marketValue: "desc" },
    });
  }

  listOrders(competitionId: number, userId: number, type: "all" | "buy" | "sell" = "all") {
    return prisma.competitionOrder.findMany({
      where: {
        competitionId,
        userId,
        ...(type !== "all" ? { transactionType: type } : {}),
      },
      orderBy: { orderTime: "desc" },
      take: 200,
    });
  }

  listPublicParticipants(competitionId: number) {
    return prisma.competitionParticipant.findMany({
      where: { competitionId, status: "active" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            advisorProfile: { select: { profileImageUrl: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  }

  async completeExpiredCompetitions() {
    const now = new Date();
    const expired = await prisma.competition.findMany({
      where: {
        endDate: { lt: now },
        status: { in: ["live", "upcoming"] },
      },
    });

    for (const c of expired) {
      await this.refreshCompetitionPrices(c.id);
      await prisma.competition.update({
        where: { id: c.id },
        data: { status: "completed" },
      });
      await this.generateWinners(c.id);
    }

    return expired.length;
  }

  async generateWinners(competitionId: number) {
    const [prizes, leaderboard] = await Promise.all([
      prisma.competitionPrize.findMany({ where: { competitionId }, orderBy: { fromRank: "asc" } }),
      prisma.competitionLeaderboard.findMany({
        where: { competitionId },
        orderBy: { rank: "asc" },
      }),
    ]);

    await prisma.competitionWinner.deleteMany({ where: { competitionId } });

    const winners = [];
    for (const entry of leaderboard) {
      if (!entry.rank) continue;
      const prize = prizes.find((p) => entry.rank! >= p.fromRank && entry.rank! <= p.toRank);
      if (!prize) continue;
      winners.push({
        competitionId,
        userId: entry.userId,
        rank: entry.rank,
        rewardType: prize.rewardType,
        rewardValue: prize.rewardValue,
        distributed: false,
      });
    }

    if (winners.length > 0) {
      await prisma.competitionWinner.createMany({ data: winners });
      await prisma.competition.update({
        where: { id: competitionId },
        data: { totalWinners: winners.length, status: "completed" },
      });
    }
  }
}

export const competitionTradingRepository = new CompetitionTradingRepository();
