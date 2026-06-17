interface TradingViewChartLoadingProps {
  message?: string;
}

export function TradingViewChartLoading({
  message = "Loading live chart…",
}: TradingViewChartLoadingProps) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#131722]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" />
      <p className="text-sm font-medium tracking-wide text-zinc-400">
        {message}
      </p>
    </div>
  );
}
