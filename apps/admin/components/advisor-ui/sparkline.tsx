type Props = {
  values: number[];
  color?: string;
  fill?: string;
  height?: number;
  width?: number;
  showArea?: boolean;
};

export default function Sparkline({
  values,
  color = "#10b981",
  fill = "rgba(16, 185, 129, 0.15)",
  height = 44,
  width = 140,
  showArea = true,
}: Props) {
  if (!values || values.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#e2e8f0"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 4;

  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - padY - ((v - min) / range) * (height - padY * 2);
    return { x, y };
  });

  const pathLine = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const pathArea = `${pathLine} L ${width} ${height} L 0 ${height} Z`;

  const gradientId = `sparkline-grad-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {showArea && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={pathArea} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={pathLine} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
}
