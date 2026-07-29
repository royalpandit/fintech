import Link from "next/link";
import { formatReturnPct, type FinuerBasketTimePeriod } from "@/lib/finuer-basket";
import BasketCardWatchButton from "@/components/finuer-basket/basket-card-watch-button";

export type FinuerBasketCardData = {
  id: number;
  basketName: string;
  shortDescription: string | null;
  market: string;
  type: string;
  benchmark: string;
  rebalanceFrequency: string;
  requiredPlan: string;
  stockCount?: number;
  lastRebalancedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
  performance: {
    oneMonthReturn: number | null;
    threeMonthReturn: number | null;
    sixMonthReturn: number | null;
    oneYearReturn: number | null;
    threeYearReturn: number | null;
    fiveYearReturn: number | null;
    sinceLaunchReturn: number | null;
    basketReturn: number | null;
    benchmarkReturn: number | null;
    alpha?: number | null;
    performanceStatus: "outperforming" | "underperforming";
  };
};

const RETURN_PERIODS: { key: FinuerBasketTimePeriod; label: string; field: keyof FinuerBasketCardData["performance"] }[] = [
  { key: "1_month", label: "1M", field: "oneMonthReturn" },
  { key: "3_months", label: "3M", field: "threeMonthReturn" },
  { key: "6_months", label: "6M", field: "sixMonthReturn" },
  { key: "1_year", label: "1Y", field: "oneYearReturn" },
  { key: "3_years", label: "3Y", field: "threeYearReturn" },
  { key: "5_years", label: "5Y", field: "fiveYearReturn" },
  { key: "since_launch", label: "Launch", field: "sinceLaunchReturn" },
];

const PERIOD_LABELS: Record<FinuerBasketTimePeriod, string> = {
  "1_month": "1 Month",
  "3_months": "3 Months",
  "6_months": "6 Months",
  "1_year": "1 Year",
  "3_years": "3 Years",
  "5_years": "5 Years",
  since_launch: "Since Launch",
};

function fmtClass(value: number | null) {
  if (value == null) return "";
  if (value > 0) return " finuer-text-success";
  if (value < 0) return " finuer-text-danger";
  return "";
}

function marketEmoji(market: string) {
  if (market === "India") return "🇮🇳";
  if (market === "US") return "🇺🇸";
  if (market === "Global") return "🌍";
  return "📊";
}

/** Compact return-by-horizon sparkline (1M → 5Y). */
function Sparkline({ values, up }: { values: (number | null)[]; up: boolean }) {
  const pts = values.map((v) => v ?? 0);
  if (pts.length < 2) return null;
  const min = Math.min(...pts, 0);
  const max = Math.max(...pts, 0);
  const range = max - min || 1;
  const w = 240;
  const h = 34;
  const step = w / (pts.length - 1);
  const coords = pts
    .map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - ((v - min) / range) * (h - 6)).toFixed(1)}`)
    .join(" ");
  const stroke = up ? "#16a34a" : "#dc2626";
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }} aria-hidden>
      <polyline points={coords} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  basket: FinuerBasketCardData;
  timePeriod?: FinuerBasketTimePeriod;
  linkable?: boolean;
};

export default function FinuerBasketCard({ basket, timePeriod = "1_year", linkable = true }: Props) {
  const p = basket.performance;
  const outperforming = p.performanceStatus === "outperforming";
  const heroReturn = p.basketReturn;
  const planClass =
    basket.requiredPlan === "premium"
      ? "finuer-basket-plan-badge finuer-basket-plan-badge--premium"
      : "finuer-basket-plan-badge finuer-basket-plan-badge--free";

  const card = (
    <article className="user-page-card finuer-basket-card">
      <div className="finuer-basket-card-head">
        <div className="finuer-basket-card-icon" aria-hidden>
          {marketEmoji(basket.market)}
        </div>
        <div className="finuer-basket-card-info">
          <h3 className="finuer-basket-card-title">{basket.basketName}</h3>
          {basket.shortDescription ? (
            <p className="finuer-basket-card-desc">{basket.shortDescription}</p>
          ) : null}
        </div>
        <span className={planClass}>{basket.requiredPlan}</span>
        {linkable ? <BasketCardWatchButton basketId={basket.id} /> : null}
      </div>

      <div className="finuer-basket-tags">
        <span className="finuer-basket-tag">{basket.market}</span>
        <span className="finuer-basket-tag">{basket.type}</span>
        <span className="finuer-basket-tag">{basket.rebalanceFrequency}</span>
        {basket.stockCount != null && basket.stockCount > 0 ? (
          <span className="finuer-basket-tag">{basket.stockCount} stocks</span>
        ) : null}
      </div>

      <div className="finuer-basket-hero-return">
        <div>
          <p className="finuer-basket-hero-return-label">{PERIOD_LABELS[timePeriod]} Return</p>
          <p className={`finuer-basket-hero-return-value${fmtClass(heroReturn)}`}>
            {formatReturnPct(heroReturn)}
          </p>
        </div>
        <span
          className={`finuer-basket-status-pill ${outperforming ? "finuer-basket-status-pill--up" : "finuer-basket-status-pill--down"}`}
        >
          <span className="finuer-basket-status-dot" />
          {outperforming ? "Outperforming" : "Underperforming"}
        </span>
      </div>

      <div style={{ margin: "8px 0 2px" }}>
        <Sparkline
          values={[p.oneMonthReturn, p.threeMonthReturn, p.sixMonthReturn, p.oneYearReturn, p.threeYearReturn, p.fiveYearReturn]}
          up={(p.oneYearReturn ?? p.sinceLaunchReturn ?? 0) >= 0}
        />
      </div>

      <div className="finuer-basket-returns-grid">
        {RETURN_PERIODS.map(({ key, label, field }) => {
          const value = p[field] as number | null;
          const active = key === timePeriod;
          return (
            <div
              key={key}
              className={`finuer-basket-return-cell${active ? " finuer-basket-return-cell--active" : ""}`}
            >
              <div className="finuer-basket-return-cell-label">{label}</div>
              <div className={`finuer-basket-return-cell-value${fmtClass(value)}`}>
                {formatReturnPct(value)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="finuer-basket-benchmark-box">
        <p className="finuer-basket-benchmark-title">vs {basket.benchmark}</p>
        <div className="finuer-basket-benchmark-compare">
          <div className="finuer-basket-benchmark-stat">
            <span className="finuer-basket-benchmark-stat-label">Basket</span>
            <span className={`finuer-basket-benchmark-stat-value${fmtClass(p.basketReturn)}`}>
              {formatReturnPct(p.basketReturn)}
            </span>
          </div>
          <div className="finuer-basket-benchmark-stat">
            <span className="finuer-basket-benchmark-stat-label">Benchmark</span>
            <span className={`finuer-basket-benchmark-stat-value${fmtClass(p.benchmarkReturn)}`}>
              {formatReturnPct(p.benchmarkReturn)}
            </span>
          </div>
          {p.alpha != null ? (
            <div className="finuer-basket-benchmark-stat">
              <span className="finuer-basket-benchmark-stat-label">Alpha</span>
              <span className={`finuer-basket-benchmark-stat-value${fmtClass(p.alpha)}`}>
                {formatReturnPct(p.alpha)}
              </span>
            </div>
          ) : null}
        </div>
        {basket.lastRebalancedAt ? (
          <p style={{ margin: "8px 0 0", fontSize: 10, color: "var(--text-muted)" }}>
            Last rebalanced {new Date(basket.lastRebalancedAt).toLocaleDateString("en-IN")}
          </p>
        ) : null}
      </div>
    </article>
  );

  if (!linkable) return card;

  return (
    <Link href={`/user/finuer-basket/${basket.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      {card}
    </Link>
  );
}
