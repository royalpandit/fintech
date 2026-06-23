import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function sslForDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes("localhost") || url.includes("127.0.0.1")) return false;
  return { rejectUnauthorized: false };
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslForDb(),
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const superAdmin = await prisma.user.findFirst({
    where: { role: "super_admin" },
    select: { id: true },
  });

  const start = new Date();
  start.setDate(start.getDate() - 3);
  const end = new Date();
  end.setDate(end.getDate() + 30);

  const existing = await prisma.competition.findFirst({
    where: { title: "Finuer Trading Challenge Q2" },
  });

  if (existing) {
    console.log("Competition seed already exists:", existing.title);
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  const competition = await prisma.competition.create({
    data: {
      title: "Finuer Trading Challenge Q2",
      shortDescription: "Compete with the best traders and win cash prizes.",
      description:
        "Join the quarterly trading challenge. Rankings are based on portfolio returns during the competition window. Top performers win cash rewards.",
      bannerImage: null,
      startDate: start,
      endDate: end,
      status: "live",
      visibility: "public",
      entryType: "free",
      entryFee: 0,
      prizePool: 100000,
      totalWinners: 10,
      maxParticipants: 500,
      createdById: superAdmin?.id ?? null,
      allowedRoles: {
        create: [{ roleKey: "all" }],
      },
      prizes: {
        create: [
          { fromRank: 1, toRank: 1, rewardType: "cash", rewardValue: "50000" },
          { fromRank: 2, toRank: 2, rewardType: "cash", rewardValue: "25000" },
          { fromRank: 3, toRank: 3, rewardType: "cash", rewardValue: "10000" },
          { fromRank: 4, toRank: 10, rewardType: "cash", rewardValue: "2000" },
        ],
      },
    },
  });

  const user = await prisma.user.findFirst({ where: { role: "user" } });
  const advisor = await prisma.user.findFirst({ where: { role: "advisor" } });

  if (user) {
    await prisma.competitionParticipant.create({
      data: { competitionId: competition.id, userId: user.id, roleKey: "user" },
    });
    await prisma.competitionLeaderboard.create({
      data: { competitionId: competition.id, userId: user.id, points: 1250, score: 18.5, rank: 2 },
    });
  }

  if (advisor) {
    await prisma.competitionParticipant.create({
      data: { competitionId: competition.id, userId: advisor.id, roleKey: "advisor" },
    });
    await prisma.competitionLeaderboard.create({
      data: { competitionId: competition.id, userId: advisor.id, points: 1580, score: 24.2, rank: 1 },
    });
  }

  const upcomingStart = new Date();
  upcomingStart.setDate(upcomingStart.getDate() + 14);
  const upcomingEnd = new Date(upcomingStart);
  upcomingEnd.setDate(upcomingEnd.getDate() + 30);

  await prisma.competition.create({
    data: {
      title: "Momentum Masters",
      shortDescription: "Upcoming momentum-based trading competition.",
      startDate: upcomingStart,
      endDate: upcomingEnd,
      status: "upcoming",
      visibility: "public",
      entryType: "paid",
      entryFee: 499,
      prizePool: 50000,
      allowedRoles: { create: [{ roleKey: "user" }, { roleKey: "advisor" }] },
      prizes: {
        create: [
          { fromRank: 1, toRank: 1, rewardType: "cash", rewardValue: "25000" },
          { fromRank: 2, toRank: 3, rewardType: "cash", rewardValue: "5000" },
        ],
      },
      createdById: superAdmin?.id ?? null,
    },
  });

  console.log("Seeded competitions:", competition.title);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
