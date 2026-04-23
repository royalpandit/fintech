import { ArrowDownRight, ArrowUpRight } from "./icons";

type Props = {
  current: number;
  previous: number;
  suffix?: string;
  invert?: boolean; // true when "down is good" (e.g. cost metrics)
};

export default function Delta({ current, previous, suffix = "", invert = false }: Props) {
  if (previous === 0 && current === 0) {
    return (
      <span className="delta-badge delta-flat">
        <span style={{ fontSize: 10 }}>—</span>
        <span>new</span>
      </span>
    );
  }
  if (previous === 0) {
    return (
      <span className="delta-badge delta-up">
        <ArrowUpRight size={10} />
        <span>new</span>
      </span>
    );
  }

  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const absPct = Math.abs(pct);
  const displayPct = absPct >= 100 ? absPct.toFixed(0) : absPct.toFixed(1);

  const isUp = pct > 0;
  const isFlat = Math.abs(pct) < 0.5;
  const isGood = invert ? !isUp : isUp;

  if (isFlat) {
    return (
      <span className="delta-badge delta-flat">
        <span>±0%</span>
      </span>
    );
  }

  return (
    <span className={`delta-badge ${isGood ? "delta-up" : "delta-down"}`}>
      {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      <span>
        {displayPct}%{suffix}
      </span>
    </span>
  );
}
