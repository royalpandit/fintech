import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { defaultChartData, serializeGroup } from "@/lib/stock-picks";
import StockPickGroupCard from "./stock-pick-group-card";
import { UserPageGrid } from "@/components/user/user-page-layout";

export const dynamic = "force-dynamic";

export default async function AiStockPicksSection() {
  const groups = await prisma.stockPickGroup.findMany({
    where: { deletedAt: null, isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 6,
    include: {
      stocks: {
        where: { deletedAt: null, isPublished: true },
        select: { id: true },
      },
    },
  });

  if (groups.length === 0) return null;

  const cards = groups.map((g) => {
    const { stocks, ...rest } = g;
    const data = serializeGroup({ ...rest, _count: { stocks: stocks.length } });
    if (!data.chartData.length && data.performancePct != null) {
      data.chartData = defaultChartData(data.performancePct);
    }
    return data;
  });

  return (
    <section className="stock-pick-home-section">
      <div className="stock-pick-home-header">
        <div>
          <h2 className="stock-pick-home-title">AI Stock Picks</h2>
          <p className="stock-pick-home-subtitle">Curated strategy groups</p>
        </div>
        <Link href="/user/stock-picks" className="stock-pick-home-link">
          View all →
        </Link>
      </div>

      <UserPageGrid>
        {cards.map((group) => (
          <StockPickGroupCard key={group.slug} group={group} />
        ))}
      </UserPageGrid>
    </section>
  );
}
