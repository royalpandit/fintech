import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function sslForDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes("localhost") || url.includes("127.0.0.1")) return false;
  return { rejectUnauthorized: false };
}

const PREDICTION_COMPETITIONS = [
  {
    title: "Weekly Banking Challenge",
    shortDescription: "Predict the top banking stock this week.",
    description:
      "Predict which banking stock will deliver the highest return during the competition window. Earn Finuer reputation points for correct predictions.",
    tags: ["Banking", "Stocks"],
    question: "Which banking stock will perform the best this week?",
    options: ["SBI", "HDFC Bank", "ICICI Bank", "Axis Bank"],
    reputationPoints: 25,
    status: "live" as const,
    daysUntilParticipationEnds: 28,
    daysUntilCompetitionEnds: 35,
  },
  {
    title: "Sector Prediction — July",
    shortDescription: "Which sector will lead the market?",
    description: "Pick the sector you believe will outperform this month.",
    tags: ["Economy", "Stocks"],
    question: "Which sector will outperform this month?",
    options: ["Banking", "IT", "Pharma", "Defence"],
    reputationPoints: 25,
    status: "upcoming" as const,
    daysUntilParticipationStarts: 7,
    daysUntilParticipationEnds: 21,
    daysUntilCompetitionEnds: 30,
  },
];

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

  const now = new Date();

  for (const spec of PREDICTION_COMPETITIONS) {
    const existing = await prisma.competition.findFirst({
      where: { title: spec.title },
      include: { options: true },
    });

    const partStart = new Date(now);
    if (spec.daysUntilParticipationStarts) {
      partStart.setDate(partStart.getDate() + spec.daysUntilParticipationStarts);
    }
    const partEnd = new Date(now);
    partEnd.setDate(
      partEnd.getDate() +
        (spec.daysUntilParticipationEnds ?? spec.daysUntilCompetitionEnds ?? 30),
    );
    const compEnd = new Date(now);
    compEnd.setDate(compEnd.getDate() + (spec.daysUntilCompetitionEnds ?? 30));

    if (existing) {
      if (!existing.question || existing.options.length === 0) {
        await prisma.competitionOption.deleteMany({ where: { competitionId: existing.id } });
        await prisma.competition.update({
          where: { id: existing.id },
          data: {
            question: spec.question,
            description: spec.description,
            shortDescription: spec.shortDescription,
            tags: spec.tags,
            participationStartDate: partStart,
            participationEndDate: partEnd,
            reputationPoints: spec.reputationPoints,
            options: {
              create: spec.options.map((label, i) => ({ label, sortOrder: i })),
            },
          },
        });
        console.log("Updated competition with prediction data:", spec.title);
      } else {
        console.log("Already configured:", spec.title);
      }
      continue;
    }

    await prisma.competition.create({
      data: {
        title: spec.title,
        shortDescription: spec.shortDescription,
        description: spec.description,
        tags: spec.tags,
        question: spec.question,
        participationStartDate: partStart,
        participationEndDate: partEnd,
        startDate: partStart,
        endDate: compEnd,
        status: spec.status,
        visibility: "public",
        reputationPoints: spec.reputationPoints,
        allowPredictionChange: false,
        requireLogin: true,
        maxParticipants: 500,
        createdById: superAdmin?.id ?? null,
        allowedRoles: { create: [{ roleKey: "all" }] },
        options: {
          create: spec.options.map((label, i) => ({ label, sortOrder: i })),
        },
      },
    });
    console.log("Created prediction competition:", spec.title);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
