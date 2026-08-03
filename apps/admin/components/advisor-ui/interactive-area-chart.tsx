"use client";

import { useState } from "react";

type DataPoint = { label: string; value: number };

// Serializable format spec — a function prop can't cross the Server→Client
// boundary, so callers pass a string and we resolve the formatter here.
type Format = "number" | "inr" | "inr-compact" | "percent";

function fmt(n: number, format: Format): string {
  switch (format) {
    case "inr":
      return `₹${Number(n).toLocaleString("en-IN")}`;
    case "inr-compact":
      if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
      if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
      if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
      return `₹${n.toFixed(0)}`;
    case "percent":
      return `${n.toFixed(1)}%`;
    case "number":
    default:
      return n.toLocaleString();
  }
}

type Props = {
  data: DataPoint[];
  height?: number;
  format?: Format;
  color?: string;
};

export default function InteractiveAreaChart({
  data,
  height = 220,
  format = "number",
  color = "#10b981",
}: Props) {
  const [hover, setHover] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
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

  const gradientId = `iarea-grad-${Math.random().toString(36).slice(2, 9)}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    y: padTop + plotH - pct * plotH,
    value: pct * max,
  }));

  const xLabels =
    data.length >= 3 ? [0, Math.floor(data.length / 2), data.length - 1] : data.map((_, i) => i);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - vbX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHover(nearest);
  }

  const hp = hover != null ? points[hover] : null;
  const hd = hover != null ? data[hover] : null;
  const tipText = hd ? `${hd.label}  ·  ${fmt(hd.value, format)}` : "";
  const tipW = Math.max(90, tipText.length * 7.6);
  const tipX = hp ? Math.min(Math.max(hp.x - tipW / 2, padLeft), width - padRight - tipW) : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padLeft} x2={width - padRight} y1={g.y} y2={g.y} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={padLeft - 6} y={g.y + 4} fontSize="10" fill="var(--text-muted)" textAnchor="end">
            {fmt(g.value, format)}
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
          fill="var(--text-muted)"
          textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
        >
          {data[i].label}
        </text>
      ))}

      {hp && hd && (
        <g pointerEvents="none">
          <line x1={hp.x} x2={hp.x} y1={padTop} y2={padTop + plotH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          <circle cx={hp.x} cy={hp.y} r="4.5" fill={color} stroke="#fff" strokeWidth="1.5" />
          <rect x={tipX} y={Math.max(hp.y - 34, padTop)} width={tipW} height={24} rx={6} fill="var(--text)" opacity="0.92" />
          <text
            x={tipX + tipW / 2}
            y={Math.max(hp.y - 34, padTop) + 16}
            fontSize="11"
            fontWeight="600"
            fill="var(--surface)"
            textAnchor="middle"
          >
            {tipText}
          </text>
        </g>
      )}
    </svg>
  );
}
