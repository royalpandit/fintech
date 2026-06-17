import {
  Skeleton,
  SkeletonAvatar,
  SkeletonGrid,
  SkeletonStatCard,
  SkeletonText,
} from "@/components/skeleton";

export default function AdvisorProfileLoading() {
  return (
    <section>
      <Skeleton width={100} height={11} style={{ marginBottom: 12 }} />

      {/* Hero */}
      <article
        style={{
          background: "#0f172a",
          color: "#fff",
          borderRadius: 18,
          padding: 28,
          marginBottom: 16,
          opacity: 0.94,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <Skeleton width={80} height={80} radius={18} variant="soft" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton width="50%" height={28} variant="soft" />
            <Skeleton width="35%" height={11} variant="soft" />
            <SkeletonText lines={2} lastLineWidth="70%" height={12} />
          </div>
          <Skeleton width={140} height={42} radius={12} variant="soft" />
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={70 + i * 6} height={22} radius={999} variant="soft" />
          ))}
        </div>
      </article>

      {/* Stats strip */}
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

      <Skeleton width={200} height={20} style={{ marginBottom: 14 }} />

      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <article
            key={i}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <Skeleton width={60} height={20} radius={999} />
              <Skeleton width={70} height={20} radius={999} />
              <span style={{ flex: 1 }} />
              <Skeleton width={50} height={11} />
            </div>
            <Skeleton width="65%" height={15} style={{ marginBottom: 6 }} />
            <SkeletonText lines={2} lastLineWidth="50%" height={11} />
          </article>
        ))}
      </div>

      <Skeleton width={120} height={20} style={{ marginBottom: 14 }} />
      <SkeletonGrid count={4} minWidth={260} />
    </section>
  );
}
