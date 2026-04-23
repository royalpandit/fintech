type DataPoint = {
  label: string;
  value: number;
};

type Props = {
  data: DataPoint[];
  height?: number;
  valueFormatter?: (n: number) => string;
  color?: string;
};

export default function AreaChart({
  data,
  height = 220,
  valueFormatter = (n) => n.toLocaleString(),
  color = "#10b981",
}: Props) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: "grid",
          placeItems: "center",
          color: "#94a3b8",
          fontSize: 13,
        }}
      >
        No data yet.
      </div>
    );
  }

  const width = 1000;
  const padLeft = 40;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = 0;

  const step = data.length > 1 ? plotW / (data.length - 1) : plotW;
  const points = data.map((d, i) => ({
    x: padLeft + i * step,
    y: padTop + plotH - ((d.value - min) / (max - min || 1)) * plotH,
  }));

  const pathLine = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const pathArea = `${pathLine} L ${padLeft + (data.length - 1) * step} ${padTop + plotH} L ${padLeft} ${padTop + plotH} Z`;

  const gradientId = `area-grad-${Math.random().toString(36).slice(2, 9)}`;

  // Y-axis gridlines (4 lines)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    y: padTop + plotH - pct * plotH,
    value: pct * max,
  }));

  // X-axis labels — show first, middle, last
  const xLabels =
    data.length >= 3
      ? [0, Math.floor(data.length / 2), data.length - 1]
      : data.map((_, i) => i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padLeft} x2={width - padRight} y1={g.y} y2={g.y} stroke="#e2e8f0" strokeDasharray="2 4" />
          <text x={padLeft - 6} y={g.y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
            {valueFormatter(g.value)}
          </text>
        </g>
      ))}

      <path d={pathArea} fill={`url(#${gradientId})`} />
      <path d={pathLine} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
          <circle cx={p.x} cy={p.y} r="6" fill={color} opacity="0.12" />
        </g>
      ))}

      {xLabels.map((i) => (
        <text
          key={i}
          x={points[i]?.x ?? padLeft}
          y={height - 6}
          fontSize="10"
          fill="#94a3b8"
          textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
        >
          {data[i].label}
        </text>
      ))}
    </svg>
  );
}
