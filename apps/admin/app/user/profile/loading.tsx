import {
  Skeleton,
  SkeletonAvatar,
  SkeletonPageHeader,
  SkeletonStatCard,
  SkeletonText,
} from "@/components/skeleton";

export default function ProfileLoading() {
  return (
    <section>
      <SkeletonPageHeader titleWidth={120} />

      {/* Hero */}
      <article
        style={{
          background: "#0c4a6e",
          opacity: 0.94,
          borderRadius: 18,
          padding: 24,
          marginBottom: 16,
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <Skeleton width={72} height={72} radius={18} variant="soft" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width="40%" height={20} variant="soft" />
          <Skeleton width="55%" height={11} variant="soft" />
          <Skeleton width="30%" height={9} variant="soft" />
        </div>
        <Skeleton width={120} height={28} radius={999} variant="soft" />
      </article>

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

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        <article
          style={{
            background: "#fff",
            border: "1px solid #eef0f4",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <Skeleton width={160} height={14} style={{ marginBottom: 14 }} />
          <div style={{ display: "grid", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Skeleton width={80} height={10} />
                <Skeleton width="60%" height={13} />
              </div>
            ))}
          </div>
          <Skeleton width={120} height={36} radius={10} style={{ marginTop: 18 }} />
        </article>

        <div style={{ display: "grid", gap: 14 }}>
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <Skeleton width={140} height={14} style={{ marginBottom: 12 }} />
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  marginBottom: 8,
                }}
              >
                <Skeleton width={90} height={11} />
                <Skeleton width={80} height={20} radius={999} />
              </div>
            ))}
            <Skeleton width="100%" height={36} radius={10} style={{ marginTop: 12 }} />
          </article>

          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <Skeleton width={120} height={14} style={{ marginBottom: 8 }} />
            <SkeletonText lines={2} lastLineWidth="50%" height={11} />
          </article>
        </div>
      </div>
    </section>
  );
}
