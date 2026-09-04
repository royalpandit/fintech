import { Skeleton } from "@/components/skeleton";

/**
 * Loading skeletons for the agent screens, shared by the investor and advisor
 * routes so the two can't drift.
 *
 * Neither route had a `loading.tsx` of its own, so both fell back to the
 * nearest boundary up the tree — /user/lab/loading.tsx, which draws a dark blue
 * hero, a chart and a six-column table. Navigating to an agent flashed a
 * skeleton for a completely different page before the real one arrived.
 */

/** The agent card grid — mirrors the real card in agents-browser.tsx. */
export function AgentsBrowserSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div style={{ marginBottom: 22 }}>
        <Skeleton width={220} height={22} />
        <div style={{ height: 8 }} />
        <Skeleton width={420} height={13} />
      </div>

      {/* Search + sort row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <Skeleton width={360} height={42} radius={10} />
        <div style={{ display: "flex", gap: 6 }}>
          <Skeleton width={62} height={28} radius={8} />
          <Skeleton width={82} height={28} radius={8} />
          <Skeleton width={54} height={28} radius={8} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: "22px 22px 18px",
              border: "1.5px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
              <Skeleton width={52} height={52} radius={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Skeleton width="70%" height={15} />
                <div style={{ height: 6 }} />
                <Skeleton width="45%" height={11} />
              </div>
            </div>
            <Skeleton width="100%" height={12} />
            <div style={{ height: 7 }} />
            <Skeleton width="92%" height={12} />
            <div style={{ height: 7 }} />
            <Skeleton width="64%" height={12} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 14,
                marginTop: 14,
                borderTop: "1px solid var(--border)",
              }}
            >
              <Skeleton width={100} height={11} />
              <Skeleton width={44} height={11} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The chat shell — header, empty-state block, composer.
 *
 * Laid out with the same classes the real screen uses so the skeleton occupies
 * the identical space and nothing jumps when the agent resolves.
 */
export function AgentChatSkeleton() {
  return (
    <div className="agent-chat-root" style={{ display: "flex", flexDirection: "column" }}>
      <header className="agent-header">
        <Skeleton width={32} height={32} radius={9} />
        <Skeleton width={92} height={32} radius={9} />
        <Skeleton width={34} height={34} radius={10} />
        <div style={{ minWidth: 0 }}>
          <Skeleton width={150} height={14} />
          <div style={{ height: 5 }} />
          <Skeleton width={96} height={14} radius={999} />
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Skeleton width={100} height={32} radius={9} />
        </div>
      </header>

      <div className="agent-scroller">
        <div className="agent-empty">
          <Skeleton width={76} height={76} radius={22} />
          <div style={{ height: 4 }} />
          <Skeleton width={190} height={21} />
          <Skeleton width={330} height={13} />
          <Skeleton width={260} height={13} />
        </div>
      </div>

      <div className="agent-footer">
        <div className="agent-col">
          <Skeleton width="100%" height={56} radius={16} />
        </div>
      </div>
    </div>
  );
}
