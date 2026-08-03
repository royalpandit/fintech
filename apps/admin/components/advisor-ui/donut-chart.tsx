"use client";

import { useState } from "react";

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
  const [active, setActive] = useState<number | null>(null);

  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  const activeSlice = active != null ? slices[active] : null;
  const centerTop = activeSlice ? activeSlice.label : centerLabel;
  const centerBottom = activeSlice
    ? `${((activeSlice.value / (total || 1)) * 100).toFixed(1)}%`
    : centerValue;

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
          {total > 0 &&
            slices.map((s, i) => {
              const fraction = s.value / total;
              const len = circumference * fraction;
              const dasharray = `${len} ${circumference - len}`;
              const rotation = (offset / total) * 360 - 90;
              offset += s.value;
              const isActive = active === i;
              const dim = active != null && !isActive;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={isActive ? thickness + 5 : thickness}
                  strokeDasharray={dasharray}
                  strokeDashoffset={0}
                  transform={`rotate(${rotation} ${cx} ${cy})`}
                  opacity={dim ? 0.35 : 1}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  style={{ transition: "opacity 0.15s, stroke-width 0.15s", cursor: "pointer" }}
                />
              );
            })}
        </svg>

        {(centerTop || centerBottom) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div>
              {centerTop && (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {centerTop}
                </div>
              )}
              {centerBottom && (
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: activeSlice ? activeSlice.color : "var(--text)",
                    letterSpacing: -0.5,
                    marginTop: 2,
                  }}
                >
                  {centerBottom}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", flex: 1, fontSize: 12 }}>
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          const isActive = active === i;
          return (
            <li
              key={i}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                margin: "0 -8px",
                borderRadius: 8,
                background: isActive ? "var(--surface-2)" : "transparent",
                borderBottom: i === slices.length - 1 ? "none" : "1px dashed var(--border)",
                cursor: "pointer",
                transition: "background 0.12s",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 12 }}>{s.label}</div>
                {s.detail && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{s.detail}</div>
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
