import { SkeletonPageHeader, SkeletonTable } from "@/components/skeleton";

/**
 * Portfolio skeleton.
 *
 * This used to be a dashboard layout — four stat cards, a 1.55fr chart beside a
 * donut, then an eight-column table — none of which the page renders. Portfolio
 * shows a header, PaperPortfolioSection (a five-across stat strip plus a
 * holdings table) and the broker cards, so the placeholder promised a shape
 * that never arrived and the layout jumped when data landed. This mirrors what
 * actually renders.
 */
export default function PortfolioLoading() {
  return (
    <section>
      <SkeletonPageHeader titleWidth={150} />

      {/* PaperPortfolioSection's five-across stat strip. */}
      <div className="user-stat-grid-5" style={{ marginBottom: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skel" style={{ height: 74, borderRadius: 14 }} />
        ))}
      </div>

      {/* Holdings. */}
      <div style={{ marginBottom: 16 }}>
        <SkeletonTable cols={6} rows={5} />
      </div>

      {/* Broker / connect card. */}
      <div className="skel" style={{ height: 150, borderRadius: 14 }} />
    </section>
  );
}
