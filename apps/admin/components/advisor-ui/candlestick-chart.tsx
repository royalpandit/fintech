import type { Candle } from "@/lib/angelone-types";

type Props = {
  data: Candle[];
  height?: number;
  bullColor?: string;
  bearColor?: string;
};

function fmtPrice(n: number) {
  if (n >= 10000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(2)}`;
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

export default function CandlestickChart({
  data,
  height = 300,
  bullColor = "#16a34a",
  bearColor = "#dc2626",
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
        No candle data.
      </div>
    );
  }

  const W = 1000;
  const padL = 64;
  const padR = 12;
  const padT = 10;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;

  const allHighs = data.map((d) => d.high);
  const allLows = data.map((d) => d.low);
  const maxP = Math.max(...allHighs);
  const minP = Math.min(...allLows);
  const range = maxP - minP || 1;

  const slotW = plotW / data.length;
  const bodyW = Math.max(2, slotW * 0.55);

  const toY = (p: number) => padT + plotH - ((p - minP) / range) * plotH;
  const toX = (i: number) => padL + i * slotW + slotW / 2;

  const gridCount = 5;
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const pct = i / gridCount;
    return { y: padT + plotH - pct * plotH, price: minP + pct * range };
  });

  const step = Math.max(1, Math.floor(data.length / 6));
  const xIndices = Array.from(
    { length: Math.floor(data.length / step) + 1 },
    (_, i) => Math.min(i * step, data.length - 1)
  ).filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      style={{ width: "100%", height, display: "block" }}
    >
      {/* Gridlines */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={g.y}
            y2={g.y}
            stroke="#e2e8f0"
            strokeDasharray="3 5"
          />
          <text
            x={padL - 6}
            y={g.y + 4}
            fontSize="10"
            fill="#94a3b8"
            textAnchor="end"
          >
            {fmtPrice(g.price)}
          </text>
        </g>
      ))}

      {/* Candles */}
      {data.map((c, i) => {
        const x = toX(i);
        const bull = c.close >= c.open;
        const col = bull ? bullColor : bearColor;
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBot = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBot - bodyTop);
        return (
          <g key={i}>
            {/* High-low wick */}
            <line
              x1={x}
              x2={x}
              y1={toY(c.high)}
              y2={toY(c.low)}
              stroke={col}
              strokeWidth="1.5"
            />
            {/* Body */}
            <rect
              x={x - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={bodyH}
              fill={col}
              fillOpacity={bull ? 1 : 0.85}
              rx="1"
            />
          </g>
        );
      })}

      {/* X-axis labels */}
      {xIndices.map((i) => (
        <text
          key={i}
          x={toX(i)}
          y={height - 8}
          fontSize="10"
          fill="#94a3b8"
          textAnchor="middle"
        >
          {fmtDate(data[i].timestamp)}
        </text>
      ))}
    </svg>
  );
}
