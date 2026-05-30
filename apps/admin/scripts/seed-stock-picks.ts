import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const existing = await prisma.stockPickGroup.count({ where: { deletedAt: null } });
  if (existing > 0) {
    console.log("Stock pick groups already exist, skipping seed.");
    return;
  }

  const groups = [
    {
      name: "Tech Titans",
      slug: "tech-titans",
      category: "Growth",
      iconEmoji: "🚀",
      performancePct: 18.42,
      benchmarkPct: 12.1,
      chartData: [
        { label: "W1", value: 10 },
        { label: "W2", value: 11.2 },
        { label: "W3", value: 12 },
        { label: "W4", value: 13.5 },
        { label: "W5", value: 14 },
        { label: "W6", value: 16 },
        { label: "W7", value: 18.42 },
      ],
      isPublished: true,
      sortOrder: 0,
      stocks: [
        { symbol: "TCS", stockName: "Tata Consultancy Services", cmp: 3465, targetPrice: 3800, stopLoss: 3200, recommendation: "buy" as const, analystNote: "Strong IT demand and margin expansion.", isPublished: true },
        { symbol: "INFY", stockName: "Infosys Ltd.", cmp: 1525, targetPrice: 1700, stopLoss: 1400, recommendation: "strong_buy" as const, analystNote: "Large deal wins and AI services tailwind.", isPublished: true },
      ],
    },
    {
      name: "Dividend Kings",
      slug: "dividend-kings",
      category: "Income",
      iconEmoji: "👑",
      performancePct: 9.85,
      benchmarkPct: 7.2,
      chartData: [
        { label: "W1", value: 6 },
        { label: "W2", value: 6.8 },
        { label: "W3", value: 7.5 },
        { label: "W4", value: 8.2 },
        { label: "W5", value: 9 },
        { label: "W6", value: 9.5 },
        { label: "W7", value: 9.85 },
      ],
      isPublished: true,
      sortOrder: 1,
      stocks: [
        { symbol: "ITC", stockName: "ITC Ltd.", cmp: 425, targetPrice: 480, stopLoss: 390, recommendation: "hold" as const, analystNote: "Stable dividend yield; watch FMCG recovery.", isPublished: true },
        { symbol: "HDFCBANK", stockName: "HDFC Bank", cmp: 1640, targetPrice: 1850, stopLoss: 1500, recommendation: "buy" as const, analystNote: "Best-in-class retail franchise.", isPublished: true },
      ],
    },
    {
      name: "AI Growth Stocks",
      slug: "ai-growth-stocks",
      category: "AI Theme",
      iconEmoji: "🤖",
      performancePct: 24.6,
      benchmarkPct: 15.3,
      chartData: [
        { label: "W1", value: 14 },
        { label: "W2", value: 16 },
        { label: "W3", value: 18 },
        { label: "W4", value: 19.5 },
        { label: "W5", value: 21 },
        { label: "W6", value: 23 },
        { label: "W7", value: 24.6 },
      ],
      isPublished: true,
      sortOrder: 2,
      stocks: [
        { symbol: "RELIANCE", stockName: "Reliance Industries", cmp: 2280, targetPrice: 2600, stopLoss: 2100, recommendation: "strong_buy" as const, analystNote: "Jio AI platform and retail scale.", isPublished: true },
      ],
    },
  ];

  for (const g of groups) {
    const { stocks, ...groupData } = g;
    await prisma.stockPickGroup.create({
      data: {
        ...groupData,
        chartData: groupData.chartData,
        stocks: {
          create: stocks.map((s, i) => ({ ...s, sortOrder: i })),
        },
      },
    });
  }

  console.log(`Seeded ${groups.length} AI Stock Pick groups.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
