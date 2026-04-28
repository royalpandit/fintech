import {
  Skeleton,
  SkeletonChart,
  SkeletonPageHeader,
  SkeletonTable,
  SkeletonWidget,
} from "@/components/skeleton";

export default function LabLoading() {
  return (
    <section>
      <SkeletonPageHeader titleWidth={220} />

      {/* Hero */}
      <article
        style={{
          background: "#0c4a6e",
          opacity: 0.94,
          borderRadius: 18,
          padding: 28,
          marginBottom: 18,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton width={100} height={18} radius={999} variant="soft" />
          <Skeleton width="80%" height={24} variant="soft" />
          <Skeleton width="60%" height={11} variant="soft" />
          <Skeleton width={150} height={42} radius={12} variant="soft" />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <Skeleton width={60} height={9} variant="soft" />
              <div style={{ height: 6 }} />
              <Skeleton width={80} height={20} variant="soft" />
            </div>
          ))}
        </div>
      </article>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <SkeletonChart height={240} />
        <SkeletonWidget rows={6} titleWidth={120} />
      </div>

      <SkeletonTable cols={6} rows={5} />
    </section>
  );
}
