import {
  Skeleton,
  SkeletonChart,
  SkeletonDonut,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonWidget,
} from "@/components/skeleton";

export default function UserHomeLoading() {
  return (
    <section>
      <div className="user-layout-rail">
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton width={220} height={22} />
              <Skeleton width={300} height={11} />
            </div>
            <Skeleton width={300} height={36} radius={10} />
          </div>

          {/* 4 KPI cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>

          {/* Performance chart + Holdings donut */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.55fr 1fr",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <SkeletonChart height={240} title="Portfolio Performance" />
            <SkeletonDonut size={170} />
          </div>

          {/* Top holdings table */}
          <SkeletonTable cols={7} rows={5} />
        </div>

        {/* Right sidebar */}
        <aside style={{ display: "grid", gap: 14 }}>
          <SkeletonWidget rows={5} titleWidth={80} />
          <SkeletonWidget rows={4} titleWidth={100} showHeader={true} />
          <SkeletonWidget rows={4} titleWidth={110} showHeader={true} />
        </aside>
      </div>
    </section>
  );
}
