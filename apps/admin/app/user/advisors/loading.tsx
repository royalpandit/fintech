import {
  SkeletonGrid,
  SkeletonPageHeader,
  SkeletonStatCard,
} from "@/components/skeleton";

export default function AdvisorsLoading() {
  return (
    <section>
      <SkeletonPageHeader titleWidth={180} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      <SkeletonGrid count={9} minWidth={280} />
    </section>
  );
}
