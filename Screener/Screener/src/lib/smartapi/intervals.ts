import type { ChartTimeframe, SecondInterval, SmartApiInterval } from "./types";

export const STANDARD_INTERVALS: {
  label: string;
  value: SmartApiInterval;
  maxDays: number;
}[] = [
  { label: "1m", value: "ONE_MINUTE", maxDays: 30 },
  { label: "5m", value: "FIVE_MINUTE", maxDays: 100 },
  { label: "15m", value: "FIFTEEN_MINUTE", maxDays: 200 },
  { label: "1h", value: "ONE_HOUR", maxDays: 400 },
  { label: "1D", value: "ONE_DAY", maxDays: 2000 },
];

export const SECOND_INTERVALS: {
  label: string;
  value: SecondInterval;
  seconds: number;
}[] = [
  { label: "15s", value: "SEC_15", seconds: 15 },
  { label: "30s", value: "SEC_30", seconds: 30 },
  { label: "45s", value: "SEC_45", seconds: 45 },
];

export const TIMEFRAME_OPTIONS: { label: string; value: ChartTimeframe }[] = [
  ...SECOND_INTERVALS.map((s) => ({ label: s.label, value: s.value })),
  ...STANDARD_INTERVALS.map((s) => ({ label: s.label, value: s.value })),
];

export function isSecondInterval(
  tf: ChartTimeframe,
): tf is SecondInterval {
  return tf === "SEC_15" || tf === "SEC_30" || tf === "SEC_45";
}

export function getSecondBucket(tf: SecondInterval): number {
  return SECOND_INTERVALS.find((s) => s.value === tf)?.seconds ?? 15;
}

export function getPollIntervalMs(tf: ChartTimeframe): number {
  if (tf === "SEC_15") return 15_000;
  if (tf === "SEC_30") return 30_000;
  if (tf === "SEC_45") return 45_000;
  return 5_000;
}

export function toApiInterval(tf: ChartTimeframe): SmartApiInterval {
  if (isSecondInterval(tf)) return "ONE_MINUTE";
  return tf;
}

export function getMaxDays(interval: ChartTimeframe): number {
  if (isSecondInterval(interval)) return 1;
  return (
    STANDARD_INTERVALS.find((o) => o.value === interval)?.maxDays ?? 100
  );
}
