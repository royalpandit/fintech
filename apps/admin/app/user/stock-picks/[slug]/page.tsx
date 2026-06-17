import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { defaultChartData, serializeGroup } from "@/lib/stock-picks";
import AreaChart from "@/components/advisor-ui/area-chart";
import RecommendationBadge from "@/components/stock-picks/recommendation-badge";
import AnalystNoteText from "@/components/stock-picks/analyst-note-text";
import {
  UserPageBackLink,
  UserPageSection,
} from "@/components/user/user-page-layout";

export const dynamic = "force-dynamic";

function formatINR(n: number | null) {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | null) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

type Params = { params: { slug: string } };

export default async function StockPickGroupDetailPage({ params }: Params) {
  const group = await prisma.stockPickGroup.findFirst({
    where: {
      slug: params.slug,
      deletedAt: null,
      isPublished: true,
    },
    include: {
      stocks: {
        where: { deletedAt: null, isPublished: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!group) notFound();

  const data = serializeGroup({
    ...group,
    _count: { stocks: group.stocks.length },
  });

  if (!data.chartData.length && data.performancePct != null) {
    data.chartData = defaultChartData(data.performancePct);
  }

  const perfPositive = (data.performancePct ?? 0) >= 0;

  return (
    <UserPageSection>
      <UserPageBackLink href="/user/stock-picks">← All AI Stock Picks</UserPageBackLink>

      <article className="stock-pick-detail-hero">
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(14,165,233,0.13), rgba(16,185,129,0.13))",
              display: "grid",
              placeItems: "center",
              fontSize: 28,
              flexShrink: 0,
            }}
          >
            {data.iconEmoji}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h1 className="user-page-title" style={{ fontSize: 20 }}>
              {data.name}
            </h1>
            {data.category ? (
              <p className="user-page-subtitle">{data.category}</p>
            ) : null}
            {data.description ? (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  color: "var(--text)",
                  lineHeight: 1.5,
                  maxWidth: 640,
                }}
              >
                {data.description}
              </p>
            ) : null}
          </div>
          <div className="stock-pick-detail-metrics">
            <div>
              <p className="stock-pick-detail-metric-label">Performance</p>
              <p
                className="stock-pick-detail-metric-value"
                style={{ color: perfPositive ? "#16a34a" : "#dc2626" }}
              >
                {fmtPct(data.performancePct)}
              </p>
            </div>
            <div>
              <p className="stock-pick-detail-metric-label">Benchmark</p>
              <p className="stock-pick-detail-metric-value" style={{ color: "var(--text-muted)" }}>
                {fmtPct(data.benchmarkPct)}
              </p>
            </div>
            <div>
              <p className="stock-pick-detail-metric-label">Stocks</p>
              <p className="stock-pick-detail-metric-value">{data.stockCount}</p>
            </div>
          </div>
        </div>

        {data.chartData.length > 0 ? (
          <div className="stock-pick-chart-wrap">
            <AreaChart
              data={data.chartData}
              color={perfPositive ? "#16a34a" : "#dc2626"}
              height={280}
              valueFormatter={(n) => `${n.toFixed(1)}%`}
            />
          </div>
        ) : null}
      </article>

      <h2
        style={{
          margin: "0 0 14px",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text)",
        }}
      >
        Stocks in this group
      </h2>

      {data.stocks && data.stocks.length > 0 ? (
        <div className="stock-pick-stocks-grid">
          {data.stocks.map((stock) => (
            <article key={stock.id} className="stock-pick-stock-card">
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>
                    {stock.symbol}
                  </span>
                  <RecommendationBadge recommendation={stock.recommendation} />
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  {stock.stockName}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  fontSize: 11,
                }}
              >
                <div>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 600 }}>CMP</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 800 }}>{formatINR(stock.cmp)}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 600 }}>Target</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 800, color: "#16a34a" }}>
                    {formatINR(stock.targetPrice)}
                  </p>
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 600 }}>SL</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 800, color: "#dc2626" }}>
                    {formatINR(stock.stopLoss)}
                  </p>
                </div>
              </div>

              {stock.analystNote ? <AnalystNoteText text={stock.analystNote} /> : null}
            </article>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No published stocks in this group yet.</p>
      )}
    </UserPageSection>
  );
}
