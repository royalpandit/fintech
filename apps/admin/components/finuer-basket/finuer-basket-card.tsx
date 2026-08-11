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
  locked?: boolean;
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

type Props = {
  basket: FinuerBasketCardData;
  timePeriod?: FinuerBasketTimePeriod;
  linkable?: boolean;
  /** List cards: 1Y + benchmark only. Detail header can use compact. */
  variant?: "list" | "compact";
};

export default function FinuerBasketCard({
  basket,
  timePeriod = "1_year",
  linkable = true,
  variant = "list",
}: Props) {
  const p = basket.performance;
  const outperforming = p.performanceStatus === "outperforming";
  const oneYear = p.oneYearReturn ?? p.basketReturn;
  const isPremiumLocked = Boolean(basket.locked);
  const planLabel = basket.requiredPlan === "premium" ? "Premium" : "Free";
  const planClass =
    basket.requiredPlan === "premium"
      ? "finuer-basket-plan-badge finuer-basket-plan-badge--premium"
      : "finuer-basket-plan-badge finuer-basket-plan-badge--free";

  const card = (
    <article
      className={`user-page-card finuer-basket-card${isPremiumLocked ? " finuer-basket-card--locked" : ""}${variant === "compact" ? " finuer-basket-card--compact" : ""}`}
    >
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
        <div className="finuer-basket-card-actions">
          <span className={planClass}>{planLabel}</span>
          {linkable ? <BasketCardWatchButton basketId={basket.id} /> : null}
        </div>
      </div>

      <div className="finuer-basket-tags">
        <span className="finuer-basket-tag">{basket.market}</span>
        <span className="finuer-basket-tag">{basket.type}</span>
        <span className="finuer-basket-tag">{basket.rebalanceFrequency}</span>
        {basket.stockCount != null && basket.stockCount > 0 ? (
          <span className="finuer-basket-tag">{basket.stockCount} stocks</span>
        ) : null}
      </div>

      {variant === "list" ? (
        <div className={isPremiumLocked ? "premium-text-blur" : undefined}>
          <div className="finuer-basket-hero-return">
            <div>
              <p className="finuer-basket-hero-return-label">
                {PERIOD_LABELS[timePeriod] || "1 Year"} Return
              </p>
              <p className={`finuer-basket-hero-return-value${fmtClass(oneYear)}`}>
                {formatReturnPct(oneYear)}
              </p>
            </div>
            <span
              className={`finuer-basket-status-pill ${outperforming ? "finuer-basket-status-pill--up" : "finuer-basket-status-pill--down"}`}
            >
              <span className="finuer-basket-status-dot" />
              {outperforming ? "Outperforming" : "Underperforming"}
            </span>
          </div>

          <div className="finuer-basket-benchmark-box">
            <p className="finuer-basket-benchmark-title">vs {basket.benchmark}</p>
            <div className="finuer-basket-benchmark-compare">
              <div className="finuer-basket-benchmark-stat">
                <span className="finuer-basket-benchmark-stat-label">Basket (1Y)</span>
                <span className={`finuer-basket-benchmark-stat-value${fmtClass(oneYear)}`}>
                  {formatReturnPct(oneYear)}
                </span>
              </div>
              <div className="finuer-basket-benchmark-stat">
                <span className="finuer-basket-benchmark-stat-label">Benchmark (1Y)</span>
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
              <p className="finuer-basket-rebalance-note">
                Last rebalanced {new Date(basket.lastRebalancedAt).toLocaleDateString("en-IN")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isPremiumLocked && variant === "list" ? (
        <div className="finuer-basket-lock-overlay">
          <p className="finuer-basket-lock-title">Finuer Pro</p>
          <p className="finuer-basket-lock-copy">
            Premium basket — open for details, or upgrade to unlock full holdings &amp; returns.
          </p>
          <Link
            href="/user/subscriptions?tab=finuer-pro"
            className="finuer-basket-lock-cta"
            onClick={(e) => e.stopPropagation()}
          >
            View Pro plans
          </Link>
        </div>
      ) : null}
    </article>
  );

  if (!linkable) return card;

  // Any basket (including premium) opens the detail page on click.
  return (
    <Link href={`/user/finuer-basket/${basket.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      {card}
    </Link>
  );
}
