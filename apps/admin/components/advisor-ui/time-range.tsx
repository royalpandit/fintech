import Link from "next/link";

type Range = {
  key: string;
  label: string;
};

const RANGES: Range[] = [
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];

export default function TimeRange({
  baseHref,
  activeKey = "1m",
}: {
  baseHref: string;
  activeKey?: string;
}) {
  return (
    <div className="time-range">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={`${baseHref}?range=${r.key}`}
          className={`time-range-item ${activeKey === r.key ? "active" : ""}`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}
