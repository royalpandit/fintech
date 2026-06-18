import {
  Skeleton,
  SkeletonDonut,
  SkeletonFeed,
  SkeletonPageHeader,
  SkeletonWidget,
} from "@/components/skeleton";

export default function UserMarketsLoading() {
  return (
    <section>
      <div className="user-layout-rail">
        <div>
          <SkeletonPageHeader titleWidth={140} />

          {/* Sentiment filter tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} width={120 + i * 8} height={36} radius={8} />
            ))}
          </div>

          {/* Asset chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} width={80} height={26} radius={999} />
            ))}
          </div>

          <SkeletonFeed count={5} />
        </div>

        <aside style={{ display: "grid", gap: 14 }}>
          <SkeletonDonut size={150} />
          <SkeletonWidget rows={5} titleWidth={120} />
        </aside>
      </div>
    </section>
  );
}
