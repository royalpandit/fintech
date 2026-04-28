import { Skeleton, SkeletonPageHeader } from "@/components/skeleton";

function SettingsCard() {
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #eef0f4",
        borderRadius: 14,
        padding: 20,
      }}
    >
      <Skeleton width={140} height={14} style={{ marginBottom: 16 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Skeleton width={80} height={10} />
            <Skeleton width="100%" height={38} radius={8} />
          </div>
        ))}
      </div>
      <Skeleton width={120} height={36} radius={10} style={{ marginTop: 18 }} />
    </article>
  );
}

export default function SettingsLoading() {
  return (
    <section>
      <SkeletonPageHeader titleWidth={120} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SettingsCard key={i} />
        ))}
      </div>
    </section>
  );
}
