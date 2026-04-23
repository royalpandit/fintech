type Props = {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
};

export default function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = "#10b981",
  trackColor = "#e2e8f0",
  label,
  sublabel,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const gradientId = `ring-grad-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
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
          <div style={{ fontSize: size > 100 ? 26 : 20, fontWeight: 800, color: "#0f172a", letterSpacing: -0.5 }}>
            {label ?? `${Math.round(clamped)}%`}
          </div>
          {sublabel && (
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginTop: 2, letterSpacing: 0.4 }}>
              {sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
