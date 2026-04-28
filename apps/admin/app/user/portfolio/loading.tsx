import {
  SkeletonChart,
  SkeletonDonut,
  SkeletonPageHeader,
  SkeletonStatCard,
  SkeletonTable,
} from "@/components/skeleton";

export default function PortfolioLoading() {
  return (
    <section>
      <SkeletonPageHeader titleWidth={150} />

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
        <SkeletonChart height={240} />
        <SkeletonDonut size={170} />
      </div>

      <SkeletonTable cols={8} rows={6} />
    </section>
  );
}
