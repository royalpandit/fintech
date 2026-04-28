import { SkeletonFeed, SkeletonPageHeader, SkeletonWidget } from "@/components/skeleton";

export default function CommunityLoading() {
  return (
    <section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
        <div>
          <SkeletonPageHeader titleWidth={140} showAction />
          <SkeletonFeed count={5} />
        </div>
        <aside style={{ display: "grid", gap: 14 }}>
          <SkeletonWidget rows={2} titleWidth={130} />
          <SkeletonWidget rows={5} titleWidth={140} />
        </aside>
      </div>
    </section>
  );
}
