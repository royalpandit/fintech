import {
  Skeleton,
  SkeletonChart,
  SkeletonDonut,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonWidget,
} from "@/components/skeleton";

export default function AdminDashboardLoading() {
  return (
    <section>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton width={240} height={22} />
              <Skeleton width={340} height={11} />
            </div>
            <Skeleton width={300} height={36} radius={10} />
          </div>

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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.55fr 1fr",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <SkeletonChart height={260} />
            <SkeletonDonut size={170} />
          </div>

          <SkeletonTable cols={6} rows={6} />
        </div>

        <aside style={{ display: "grid", gap: 14 }}>
          <SkeletonWidget rows={5} titleWidth={140} />
          <SkeletonWidget rows={6} titleWidth={120} />
          <SkeletonWidget rows={5} titleWidth={130} />
        </aside>
      </div>
    </section>
  );
}
