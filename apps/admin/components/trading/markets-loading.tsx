import { Skeleton } from "@/components/skeleton";

/**
 * Loading skeleton for the Markets screen, shared by the investor and advisor
 * routes so the two can't drift.
 *
 * The old /user/markets/loading.tsx drew a two-column rail with a donut chart,
 * a post feed and four "sentiment filter" tabs — none of which Markets has had
 * for a while. It was a skeleton for a page that no longer exists, so the
 * screen visibly rearranged itself the moment real data arrived. The advisor
 * route had no boundary at all.
 *
 * Shapes below mirror the real markup: header, segmented tabs, index strip,
 * then the three-column panel layout.
 */
export default function MarketsLoading() {
  return (
    <section>
      {/* Header */}
      <div className="mkt-head">
        <div>
          <Skeleton width={130} height={24} />
          <div style={{ height: 7 }} />
          <Skeleton width={290} height={13} />
        </div>
      </div>

      {/* Segmented instrument tabs */}
      <div className="mkt-tabs" aria-hidden>
        {[46, 118, 104, 52, 104, 44, 60, 88, 62].map((w, i) => (
          <Skeleton key={i} width={w} height={30} radius={9} />
        ))}
      </div>

      {/* Index strip */}
      <div className="mkt-index-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mkt-index-card mkt-index-card--skel" aria-hidden>
            <Skeleton width={74} height={11} />
            <div style={{ height: 8 }} />
            <Skeleton width={122} height={25} />
            <div style={{ height: 8 }} />
            <Skeleton width={96} height={18} radius={7} />
          </div>
        ))}
      </div>

      {/* Panel columns */}
      <div className="mkt-all-grid">
        <div className="mkt-col">
          <PanelSkeleton rows={5} />
          <PanelSkeleton rows={2} />
        </div>
        <div className="mkt-col">
          <PanelSkeleton rows={5} />
          <PanelSkeleton rows={5} />
        </div>
        <div className="mkt-col">
          <PanelSkeleton rows={7} />
        </div>
      </div>
    </section>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <article className="mkt-panel" aria-hidden>
      <div className="mkt-panel-head">
        <Skeleton width={26} height={26} radius={8} />
        <Skeleton width={132} height={13} />
      </div>
      <div style={{ display: "grid", gap: 14, padding: "14px 16px" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Skeleton width={72} height={12} />
            <div style={{ flex: 1 }} />
            <Skeleton width={62} height={12} />
            <Skeleton width={54} height={18} radius={7} />
          </div>
        ))}
      </div>
    </article>
  );
}
