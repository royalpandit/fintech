/**
 * Drop-in shimmer placeholders for the many spots that still rendered a bare
 * "Loading…" string.
 *
 * The app already had a shimmer system (`.skel` in globals.css, themed for both
 * palettes in theme.css, plus the Skeleton* components) but roughly two dozen
 * call sites never adopted it, so half the product flashed grey text while the
 * other half shimmered. These are deliberately layout-agnostic so they can
 * replace a bare loading string anywhere without knowing what surrounds it.
 *
 * No "use client" — plain markup, so server components and Suspense fallbacks
 * can use it too.
 */

/** A few shimmer bars. The default reads as "a short list is coming". */
export function LoadingRows({
  rows = 3,
  height = 14,
  gap = 10,
  /** Last row is shorter so it reads as text rather than a block. */
  lastRowWidth = "62%",
  className = "",
  style,
}: {
  rows?: number;
  height?: number;
  gap?: number;
  lastRowWidth?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ display: "grid", gap, width: "100%", ...style }}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, i) => (
        <span
          key={i}
          className="skel"
          style={{
            height,
            width: i === rows - 1 && rows > 1 ? lastRowWidth : "100%",
            borderRadius: 6,
          }}
        />
      ))}
    </div>
  );
}

/** Card-shaped shimmer, for grids and feeds that load whole cards at a time. */
export function LoadingCards({
  count = 3,
  height = 96,
  gap = 12,
}: {
  count?: number;
  height?: number;
  gap?: number;
}) {
  return (
    <div
      style={{ display: "grid", gap }}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 16,
            background: "var(--surface)",
            minHeight: height,
            display: "grid",
            gap: 10,
            alignContent: "start",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              className="skel"
              style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}
            />
            <span className="skel" style={{ height: 12, width: "42%", borderRadius: 6 }} />
          </div>
          <span className="skel" style={{ height: 12, width: "100%", borderRadius: 6 }} />
          <span className="skel" style={{ height: 12, width: "78%", borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Shimmer rows for a table body that is still loading.
 *
 * The market views each rendered a single centred "Loading…" cell instead —
 * "Loading funds…", "Loading scrip master…" — so a table collapsed to one grey
 * line and then jumped to full height when data landed. These occupy roughly
 * the space the real rows will, so the layout does not move.
 *
 * Widths cycle rather than being uniform: a column of identical bars reads as
 * a progress graphic, while uneven ones read as text about to appear.
 */
export function LoadingTableRows({
  cols,
  rows = 5,
  /** First column is usually a name and wider than the figures after it. */
  firstColWidth = "58%",
}: {
  cols: number;
  rows?: number;
  firstColWidth?: string;
}) {
  const widths = ["46%", "62%", "38%", "54%"];
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} style={{ padding: "12px 16px" }}>
              <span
                className="skel"
                style={{
                  display: "block",
                  height: 12,
                  borderRadius: 6,
                  width: c === 0 ? firstColWidth : widths[(r + c) % widths.length],
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Inline shimmer for a single value being fetched (a count, a price, a name). */
export function LoadingInline({ width = 90, height = 12 }: { width?: number | string; height?: number }) {
  return (
    <span
      className="skel"
      style={{ display: "inline-block", width, height, borderRadius: 6, verticalAlign: "middle" }}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    />
  );
}
