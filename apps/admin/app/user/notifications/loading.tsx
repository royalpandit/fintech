import { Skeleton, SkeletonPageHeader, SkeletonAvatar } from "@/components/skeleton";

export default function NotificationsLoading() {
  return (
    <section>
      <SkeletonPageHeader titleWidth={150} />

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width={100} height={36} radius={8} />
        ))}
      </div>

      <article
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: "14px 18px",
              borderBottom: i === 7 ? "none" : "1px solid var(--border)",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              background: i < 3 ? "var(--primary-soft)" : "transparent",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: i < 3 ? "#0ea5e9" : "#cbd5e1",
                marginTop: 6,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Skeleton width={180} height={13} />
                <Skeleton width={50} height={16} radius={999} />
              </div>
              <Skeleton width="80%" height={11} />
            </div>
            <Skeleton width={60} height={10} />
          </div>
        ))}
      </article>
    </section>
  );
}
