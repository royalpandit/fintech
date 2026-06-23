import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { computePerformanceStatus } from "../lib/finuer-basket";

function sslForDb(url: string | undefined) {
  if (!url) return undefined;
  if (url.includes("localhost") || url.includes("127.0.0.1")) return undefined;
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslForDb(process.env.DATABASE_URL),
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEFAULT_MARKETS = ["All Markets", "India", "US", "Global"];
const DEFAULT_TYPES = [
  "Small Cap",
  "Mid Cap",
  "Large Cap",
  "Sector",
  "Value",
  "Dividend",
  "Growth",
  "Momentum",
  "Theme",
];

const DEFAULT_BENCHMARKS: Record<string, string[]> = {
  India: ["Nifty 50", "Nifty Midcap 150", "Nifty Smallcap 250"],
  US: ["S&P 500", "Nasdaq 100"],
  Global: ["MSCI World"],
};

async function upsertMarket(name: string) {
  return prisma.finuerMarket.upsert({
    where: { name },
    create: { name, status: "active" },
    update: { status: "active" },
  });
}

async function upsertType(name: string) {
  return prisma.finuerBasketType.upsert({
    where: { name },
    create: { name, status: "active" },
    update: { status: "active" },
  });
}

async function main() {
  console.log("Seeding Finuer Basket defaults…");

  const markets: Record<string, number> = {};
  for (const name of DEFAULT_MARKETS) {
    const m = await upsertMarket(name);
    markets[name] = m.id;
    console.log(`  market: ${name}`);
  }

  for (const name of DEFAULT_TYPES) {
    await upsertType(name);
    console.log(`  type: ${name}`);
  }

  for (const [marketName, benchNames] of Object.entries(DEFAULT_BENCHMARKS)) {
    const marketId = markets[marketName];
    if (!marketId) continue;
    for (const bench of benchNames) {
      await prisma.finuerBenchmark.upsert({
        where: { marketId_name: { marketId, name: bench } },
        create: { marketId, name: bench },
        update: {},
      });
      console.log(`  benchmark: ${marketName} / ${bench}`);
    }
  }

  const india = markets.India;
  const largeCap = await prisma.finuerBasketType.findUnique({ where: { name: "Large Cap" } });
  const nifty = await prisma.finuerBenchmark.findFirst({
    where: { marketId: india, name: "Nifty 50" },
  });

  if (india && largeCap && nifty) {
    const existing = await prisma.finuerBasket.findFirst({
      where: { basketName: "Finuer India Leaders" },
    });
    if (!existing) {
      const sinceLaunch = 18.5;
      const benchSince = 14.2;
      const created = await prisma.finuerBasket.create({
        data: {
          basketName: "Finuer India Leaders",
          shortDescription: "Large-cap India basket benchmarked against Nifty 50.",
          marketId: india,
          typeId: largeCap.id,
          benchmarkId: nifty.id,
          status: "active",
          visibility: "public",
          rebalanceFrequency: "monthly",
          requiredPlan: "free",
          performance: {
            create: {
              oneMonthReturn: 2.4,
              threeMonthReturn: 5.2,
              sixMonthReturn: 8.1,
              oneYearReturn: 15.6,
              threeYearReturn: 42.3,
              fiveYearReturn: 68.9,
              sinceLaunchReturn: sinceLaunch,
              benchmarkOneMonth: 1.8,
              benchmarkThreeMonth: 4.2,
              benchmarkSixMonth: 6.5,
              benchmarkOneYear: 12.4,
              benchmarkThreeYear: 36.1,
              benchmarkFiveYear: 58.2,
              benchmarkSinceLaunch: benchSince,
              performanceStatus: computePerformanceStatus(sinceLaunch, benchSince),
            },
          },
        },
      });
      console.log("  sample basket: Finuer India Leaders");
      await seedStocks(created.id);
    } else {
      await seedStocks(existing.id);
    }
  }

  console.log("Finuer Basket seed complete.");
}

async function seedStocks(basketId: number) {
  const samples = [
    { symbol: "RELIANCE", stockName: "Reliance Industries", weightPct: 22, cmp: 1425 },
    { symbol: "HDFCBANK", stockName: "HDFC Bank", weightPct: 18, cmp: 1680 },
    { symbol: "INFY", stockName: "Infosys", weightPct: 15, cmp: 1580 },
    { symbol: "TCS", stockName: "Tata Consultancy Services", weightPct: 15, cmp: 3850 },
    { symbol: "ICICIBANK", stockName: "ICICI Bank", weightPct: 12, cmp: 1120 },
    { symbol: "ITC", stockName: "ITC Ltd", weightPct: 10, cmp: 465 },
    { symbol: "LT", stockName: "Larsen & Toubro", weightPct: 8, cmp: 3580 },
  ];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const exists = await prisma.finuerBasketStock.findFirst({
      where: { basketId, symbol: s.symbol, deletedAt: null },
    });
    if (!exists) {
      await prisma.finuerBasketStock.create({
        data: { basketId, ...s, exchange: "NSE", sortOrder: i },
      });
      console.log(`  stock: ${s.symbol}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
