import { BRAND_COLORS } from "@/lib/brand";
import type { ChartPoint } from "@/lib/stock-picks";

type Props = {
  data: ChartPoint[];
  color?: string;
  height?: number;
  width?: number;
  gridColor?: string;
};

export default function MiniSparkChart({
  data,
  color = BRAND_COLORS.success,
  height = 48,
  width = 120,
  gridColor = BRAND_COLORS.light.chartGrid,
}: Props) {
  if (!data?.length) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={gridColor} strokeWidth={1} />
      </svg>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 4;

  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const area = `${points} L ${width - pad},${height - pad} L ${pad},${height - pad} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
