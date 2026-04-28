import { Skeleton, SkeletonAvatar, SkeletonText } from "@/components/skeleton";

export default function PostDetailLoading() {
  return (
    <section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
        <div>
          <Skeleton width={80} height={11} style={{ marginBottom: 12 }} />

          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <SkeletonAvatar size={48} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton width={180} height={14} />
                <Skeleton width={120} height={10} />
              </div>
              <Skeleton width={90} height={28} radius={999} />
            </div>

            <Skeleton width="80%" height={28} style={{ marginBottom: 12 }} />

            <SkeletonText lines={5} lastLineWidth="55%" height={13} gap={10} />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Skeleton width={80} height={26} radius={999} />
              <Skeleton width={70} height={26} radius={999} />
              <Skeleton width={90} height={26} radius={999} />
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 10,
              }}
            >
              <SkeletonText lines={2} lastLineWidth="60%" />
            </div>

            <div
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid #eef0f4",
                display: "flex",
                gap: 16,
              }}
            >
              <Skeleton width={100} height={32} radius={8} />
              <Skeleton width={120} height={20} />
              <span style={{ flex: 1 }} />
              <Skeleton width={140} height={32} radius={8} />
            </div>
          </article>

          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 24,
            }}
          >
            <Skeleton width={140} height={14} style={{ marginBottom: 14 }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: "#f8fafc",
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <Skeleton width={120} height={11} />
                  <Skeleton width={50} height={9} />
                </div>
                <SkeletonText lines={2} lastLineWidth="70%" height={10} />
              </div>
            ))}
          </article>
        </div>

        <aside>
          <article
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <Skeleton width={56} height={56} radius={14} style={{ marginBottom: 12 }} />
            <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
            <Skeleton width="50%" height={11} style={{ marginBottom: 12 }} />
            <SkeletonText lines={3} lastLineWidth="60%" height={11} />
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <Skeleton width={60} height={20} radius={999} />
              <Skeleton width={70} height={20} radius={999} />
              <Skeleton width={50} height={20} radius={999} />
            </div>
            <Skeleton width="100%" height={36} radius={10} style={{ marginTop: 14 }} />
            <Skeleton width="100%" height={36} radius={10} style={{ marginTop: 8 }} />
          </article>
        </aside>
      </div>
    </section>
  );
}
