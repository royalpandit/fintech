import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { defaultChartData, serializeGroup } from "@/lib/stock-picks";
import StockPickGroupCard from "@/components/stock-picks/stock-pick-group-card";
import {
  UserPageGrid,
  UserPageHeader,
  UserPageSection,
  UserPageStatCard,
  UserPageStatsGrid,
} from "@/components/user/user-page-layout";

export const dynamic = "force-dynamic";

export default async function UserStockPicksPage() {
  const groups = await prisma.stockPickGroup.findMany({
    where: { deletedAt: null, isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      stocks: {
        where: { deletedAt: null, isPublished: true },
        select: { id: true },
      },
    },
  });

  const cards = groups.map((g) => {
    const { stocks, ...rest } = g;
    const data = serializeGroup({ ...rest, _count: { stocks: stocks.length } });
    if (!data.chartData.length && data.performancePct != null) {
      data.chartData = defaultChartData(data.performancePct);
    }
    return data;
  });

  const totalStocks = cards.reduce((s, g) => s + g.stockCount, 0);
  const avgPerf =
    cards.length > 0
      ? cards.reduce((s, g) => s + (g.performancePct ?? 0), 0) / cards.length
      : 0;
  const avgBench =
    cards.length > 0
      ? cards.reduce((s, g) => s + (g.benchmarkPct ?? 0), 0) / cards.length
      : 0;

  return (
    <UserPageSection>
      <UserPageHeader
        title="Stock Basket"
        subtitle={`${cards.length.toLocaleString()} curated strategy groups`}
      />

      <UserPageStatsGrid>
        <UserPageStatCard label="Published Groups" value={cards.length.toLocaleString()} color="#10b981" />
        <UserPageStatCard
          label="Avg Performance"
          value={cards.length ? `${avgPerf >= 0 ? "+" : ""}${avgPerf.toFixed(1)}%` : "—"}
          color="#0ea5e9"
        />
        <UserPageStatCard
          label="Avg Benchmark"
          value={cards.length ? `${avgBench >= 0 ? "+" : ""}${avgBench.toFixed(1)}%` : "—"}
          color="#f59e0b"
        />
        <UserPageStatCard label="Total Stocks" value={totalStocks.toLocaleString()} color="#7c3aed" />
      </UserPageStatsGrid>

      <UserPageGrid>
        {cards.length === 0 ? (
          <div className="user-page-empty">
            <p style={{ margin: 0 }}>No stock pick groups published yet. Check back soon.</p>
            <Link
              href="/user/home"
              style={{
                display: "inline-block",
                marginTop: 12,
                fontSize: 12,
                fontWeight: 700,
                color: "#0ea5e9",
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          cards.map((group) => <StockPickGroupCard key={group.slug} group={group} />)
        )}
      </UserPageGrid>
    </UserPageSection>
  );
}
