type Slice = {
  label: string;
  value: number;
  color: string;
  detail?: string;
};

type Props = {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
};

export default function DonutChart({
  slices,
  size = 180,
  thickness = 28,
  centerLabel,
  centerValue,
}: Props) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />
          {total > 0 &&
            slices.map((s, i) => {
              const fraction = s.value / total;
              const len = circumference * fraction;
              const dasharray = `${len} ${circumference - len}`;
              const rotation = (offset / total) * 360 - 90;
              offset += s.value;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={dasharray}
                  strokeDashoffset={0}
                  transform={`rotate(${rotation} ${cx} ${cy})`}
                  style={{ transition: "stroke-dasharray 0.4s" }}
                />
              );
            })}
        </svg>

        {(centerLabel || centerValue) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
            }}
          >
            <div>
              {centerLabel && (
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {centerLabel}
                </div>
              )}
              {centerValue && (
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: -0.5,
                    marginTop: 2,
                  }}
                >
                  {centerValue}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", flex: 1, fontSize: 12 }}>
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: i === slices.length - 1 ? "none" : "1px dashed #eef0f4",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: s.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    color: "#0f172a",
                    fontSize: 12,
                  }}
                >
                  {s.label}
                </div>
                {s.detail && (
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{s.detail}</div>
                )}
              </div>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
