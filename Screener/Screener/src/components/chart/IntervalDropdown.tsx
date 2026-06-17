import { TIMEFRAME_OPTIONS } from "@/lib/smartapi/intervals";
import type { ChartTimeframe } from "@/lib/smartapi/types";

interface IntervalDropdownProps {
  value: ChartTimeframe;
  onChange: (value: ChartTimeframe) => void;
}

export function IntervalDropdown({ value, onChange }: IntervalDropdownProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      <span className="hidden font-medium sm:inline">Timeframe</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ChartTimeframe)}
        className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm outline-none focus:border-[#4a69bd] focus:ring-2 focus:ring-[#4a69bd]/20"
      >
        {TIMEFRAME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
