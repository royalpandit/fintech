import {
  Skeleton,
  SkeletonFeed,
  SkeletonPageHeader,
  SkeletonWidget,
} from "@/components/skeleton";

export default function UserFeedLoading() {
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
          <SkeletonPageHeader titleWidth={120} />

          <Skeleton width={90} height={11} style={{ marginBottom: 10 }} />
          <SkeletonFeed count={2} />

          <Skeleton width={90} height={11} style={{ margin: "20px 0 10px" }} />
          <SkeletonFeed count={4} />
        </div>

        <aside style={{ display: "grid", gap: 14 }}>
          <SkeletonWidget rows={5} titleWidth={140} />
          <SkeletonWidget rows={6} titleWidth={150} />
        </aside>
      </div>
    </section>
  );
}
