import type { CSSProperties } from "react";

type SkelProps = {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  style?: CSSProperties;
  variant?: "default" | "soft";
};

/**
 * A single shimmering skeleton block.
 * Use inline width/height/radius or pass full style overrides.
 */
export function Skeleton({
  width = "100%",
  height = 14,
  radius = 8,
  style,
  variant = "default",
}: SkelProps) {
  return (
    <span
      className={variant === "soft" ? "skel-soft" : "skel"}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/**
 * Circular avatar skeleton.
 */
export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton width={size} height={size} radius={999} />;
}

/**
 * A multi-line text block.
 */
export function SkeletonText({
  lines = 3,
  lastLineWidth = "70%",
  height = 11,
  gap = 8,
}: {
  lines?: number;
  lastLineWidth?: string;
  height?: number;
  gap?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={height}
          width={i === lines - 1 ? lastLineWidth : "100%"}
        />
      ))}
    </div>
  );
}

/**
 * A KPI / stat card skeleton matching .stat-card layout.
 */
export function SkeletonStatCard() {
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <Skeleton width={100} height={11} />
      <div style={{ height: 10 }} />
      <Skeleton width="60%" height={26} radius={6} />
      <div style={{ height: 8 }} />
      <Skeleton width={80} height={10} />
    </article>
  );
}

/**
 * Generic widget card skeleton — title + body rows.
 */
export function SkeletonWidget({
  titleWidth = 140,
  rows = 5,
  rowHeight = 30,
  showHeader = true,
}: {
  titleWidth?: number;
  rows?: number;
  rowHeight?: number;
  showHeader?: boolean;
}) {
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 18,
      }}
    >
      {showHeader && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Skeleton width={titleWidth} height={14} />
          <Skeleton width={50} height={10} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <SkeletonAvatar size={28} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <Skeleton height={11} width="55%" />
              <Skeleton height={9} width="35%" />
            </div>
            <Skeleton width={50} height={11} />
          </div>
        ))}
      </div>
    </article>
  );
}

/**
 * Skeleton for a chart card (header + chart area).
 */
export function SkeletonChart({ height = 240, title = "Chart" }: { height?: number; title?: string }) {
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <Skeleton width={title.length * 8 + 20} height={14} />
        <Skeleton width={180} height={28} radius={10} />
      </div>
      <div
        style={{
          height,
          borderRadius: 10,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(14, 165, 233, 0.05), transparent)",
        }}
      >
        <svg
          viewBox="0 0 600 240"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%" }}
        >
          <defs>
            <linearGradient id="skel-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.5">
                <animate
                  attributeName="stop-opacity"
                  values="0.3;0.6;0.3"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 60, 100, 140, 180].map((y) => (
            <line
              key={y}
              x1={0}
              x2={600}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="2 4"
            />
          ))}
          <path
            d="M 0 180 L 80 150 L 160 165 L 240 110 L 320 130 L 400 80 L 480 95 L 560 60 L 600 70 L 600 240 L 0 240 Z"
            fill="url(#skel-area)"
          />
          <path
            d="M 0 180 L 80 150 L 160 165 L 240 110 L 320 130 L 400 80 L 480 95 L 560 60 L 600 70"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="200"
            strokeDashoffset="200"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="200"
              to="0"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </div>
    </article>
  );
}

/**
 * Donut chart skeleton.
 */
export function SkeletonDonut({ size = 170 }: { size?: number }) {
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <Skeleton width={100} height={14} />
        <Skeleton width={60} height={10} />
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={(size - 26) / 2}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="26"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={(size - 26) / 2}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="26"
              strokeDasharray="60 120"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ animation: "skel-pulse 1.6s infinite" }}
            />
          </svg>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {[80, 65, 50, 40].map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Skeleton width={8} height={8} radius={999} />
              <Skeleton width={`${w}%`} height={10} />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

/**
 * Skeleton for a table — header row + N body rows.
 */
export function SkeletonTable({
  cols = 5,
  rows = 8,
  hideHeader = false,
}: {
  cols?: number;
  rows?: number;
  hideHeader?: boolean;
}) {
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {!hideHeader && (
        <div
          style={{
            padding: "12px 18px",
            background: "var(--hover)",
            borderBottom: "1px solid var(--border)",
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 16,
          }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} width="60%" height={10} />
          ))}
        </div>
      )}
      <div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            style={{
              padding: "14px 18px",
              borderBottom: r === rows - 1 ? "none" : "1px solid #f1f5f9",
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 16,
              alignItems: "center",
            }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                width={c === 0 ? "75%" : `${40 + ((r * c * 13) % 50)}%`}
                height={c === 0 ? 13 : 11}
              />
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}

/**
 * A feed of post cards (for /user/markets, /user/community, etc).
 */
export function SkeletonFeed({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <article
          key={i}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
            <SkeletonAvatar size={38} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <Skeleton width={140} height={12} />
              <Skeleton width={90} height={9} />
            </div>
            <Skeleton width={70} height={20} radius={999} />
          </div>
          <Skeleton width="80%" height={16} style={{ marginBottom: 8 }} />
          <SkeletonText lines={2} lastLineWidth="50%" />
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <Skeleton width={60} height={20} radius={999} />
            <Skeleton width={70} height={20} radius={999} />
            <Skeleton width={80} height={20} radius={999} />
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              gap: 16,
            }}
          >
            <Skeleton width={50} height={12} />
            <Skeleton width={70} height={12} />
            <span style={{ flex: 1 }} />
            <Skeleton width={80} height={28} radius={8} />
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * A grid of cards (for /user/advisors, /user/courses).
 */
export function SkeletonGrid({
  count = 6,
  minWidth = 280,
}: {
  count?: number;
  minWidth?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
        gap: 14,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <article
          key={i}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <SkeletonAvatar size={48} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <Skeleton width="70%" height={13} />
              <Skeleton width="50%" height={10} />
            </div>
          </div>
          <SkeletonText lines={2} lastLineWidth="65%" height={11} />
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid #f1f5f9",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j}>
                <Skeleton width={40} height={9} />
                <div style={{ height: 4 }} />
                <Skeleton width={50} height={13} />
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Page header (title + subtitle + optional right pill).
 */
export function SkeletonPageHeader({
  showAction = false,
  titleWidth = 220,
}: {
  showAction?: boolean;
  titleWidth?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton width={titleWidth} height={22} />
        <Skeleton width={titleWidth + 80} height={11} />
      </div>
      {showAction && <Skeleton width={140} height={36} radius={10} />}
    </div>
  );
}
