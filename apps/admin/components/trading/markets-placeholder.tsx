// Honest placeholder for instrument classes with no free data feed
// (IPO, ETFs*, Commodities*, Global). No fabricated numbers.
export default function MarketsPlaceholder({
  title,
  blurb,
  needs,
}: {
  title: string;
  blurb: string;
  needs: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 24px",
        background: "var(--surface)",
        border: "1px dashed var(--border)",
        borderRadius: 14,
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }}>🧩</div>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{title}</h3>
      <p style={{ margin: "0 auto 10px", maxWidth: 460, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
        {blurb}
      </p>
      <span
        style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 12px",
          borderRadius: 999,
          background: "var(--surface-2)",
          color: "var(--text-muted)",
        }}
      >
        Needs: {needs}
      </span>
    </div>
  );
}
