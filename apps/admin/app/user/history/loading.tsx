import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonStatCard,
  SkeletonTable,
} from "@/components/skeleton";

export default function HistoryLoading() {
  return (
    <section>
      <SkeletonPageHeader titleWidth={160} />

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

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width={120} height={36} radius={8} />
        ))}
      </div>

      <SkeletonTable cols={7} rows={8} />
    </section>
  );
}
