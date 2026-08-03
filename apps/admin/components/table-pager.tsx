import Link from "next/link";

// Server component — Link-based pagination that preserves existing filters.
export default function TablePager({
  basePath,
  params,
  page,
  totalPages,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total?: number;
}) {
  if (totalPages <= 1) return null;

  const build = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const btn: React.CSSProperties = {
    padding: "7px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
  };
  const disabled: React.CSSProperties = { ...btn, opacity: 0.4, pointerEvents: "none" };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Page {page} of {totalPages}
        {typeof total === "number" ? ` · ${total.toLocaleString()} total` : ""}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        {page > 1 ? (
          <Link href={build(page - 1)} style={btn}>
            ← Previous
          </Link>
        ) : (
          <span style={disabled}>← Previous</span>
        )}
        {page < totalPages ? (
          <Link href={build(page + 1)} style={btn}>
            Next →
          </Link>
        ) : (
          <span style={disabled}>Next →</span>
        )}
      </div>
    </div>
  );
}
