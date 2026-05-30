import Link from "next/link";
import MiniSparkChart from "./mini-spark-chart";
import { BRAND_COLORS } from "@/lib/brand";
import type { ChartPoint } from "@/lib/stock-picks";

export type StockPickGroupCardData = {
  slug: string;
  name: string;
  category?: string | null;
  iconEmoji: string;
  performancePct: number | null;
  benchmarkPct: number | null;
  chartData: ChartPoint[];
  stockCount: number;
};

function fmtPct(n: number | null) {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function StockPickGroupCard({ group }: { group: StockPickGroupCardData }) {
  const perfPositive = (group.performancePct ?? 0) >= 0;
  const benchPositive = (group.benchmarkPct ?? 0) >= 0;
  const chartColor = perfPositive ? BRAND_COLORS.success : BRAND_COLORS.danger;

  return (
    <article className="user-page-card finuer-card stock-pick-group-card">
      <div className="stock-pick-group-card-head">
        <div className="stock-pick-group-card-icon">{group.iconEmoji}</div>
        <div className="stock-pick-group-card-info">
          <h3 className="stock-pick-group-card-title">{group.name}</h3>
          {group.category ? (
            <p className="stock-pick-group-card-category">{group.category}</p>
          ) : null}
        </div>
        <div className="stock-pick-group-card-spark">
          <MiniSparkChart data={group.chartData} color={chartColor} width={100} height={40} />
        </div>
      </div>

      <div className="stock-pick-group-card-stats">
        <div>
          <p className="stock-pick-group-card-stat-label">Performance</p>
          <p
            className={`stock-pick-group-card-stat-value${perfPositive ? " finuer-text-success" : " finuer-text-danger"}`}
          >
            {fmtPct(group.performancePct)}
          </p>
        </div>
        <div>
          <p className="stock-pick-group-card-stat-label">Benchmark</p>
          <p
            className={`stock-pick-group-card-stat-value${benchPositive ? " finuer-text-muted" : " finuer-text-danger"}`}
          >
            {fmtPct(group.benchmarkPct)}
          </p>
        </div>
        <div>
          <p className="stock-pick-group-card-stat-label">Stocks</p>
          <p className="stock-pick-group-card-stat-value">{group.stockCount}</p>
        </div>
      </div>

      <div className="stock-pick-group-card-actions">
        <Link href={`/user/stock-picks/${group.slug}`} className="stock-pick-group-card-btn">
          View Details
        </Link>
      </div>
    </article>
  );
}
