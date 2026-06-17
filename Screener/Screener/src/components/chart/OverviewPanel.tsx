"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/client/fetch-api";

interface OverviewPanelProps {
  symbolQuery: string;
}

interface OverviewData {
  symbol: {
    displayName: string;
    tradingsymbol: string;
    exchange: string;
  };
  quote: {
    ltp: number;
    open: number;
    high: number;
    low: number;
    close: number;
  };
}

export function OverviewPanel({ symbolQuery }: OverviewPanelProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const json = await fetchApi<OverviewData>(
          `/api/smartapi/ltp?symbol=${encodeURIComponent(symbolQuery)}`,
        );
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbolQuery]);

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-[#4a69bd]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50 p-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { quote, symbol } = data;
  const change = quote.ltp - quote.close;
  const changePct = quote.close ? (change / quote.close) * 100 : 0;
  const isUp = change >= 0;

  const stats = [
    { label: "Open", value: quote.open },
    { label: "High", value: quote.high },
    { label: "Low", value: quote.low },
    { label: "Prev. Close", value: quote.close },
  ];

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {symbol.exchange} · {symbol.tradingsymbol}
        </p>
        <h2 className="mt-1 text-3xl font-semibold text-zinc-900">
          {symbol.displayName}
        </h2>

        <div className="mt-4 flex flex-wrap items-baseline gap-3">
          <span className="text-4xl font-bold text-zinc-900">
            ₹{quote.ltp.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </span>
          <span
            className={`text-lg font-medium ${isUp ? "text-emerald-600" : "text-red-600"}`}
          >
            {isUp ? "+" : ""}
            {change.toFixed(2)} ({isUp ? "+" : ""}
            {changePct.toFixed(2)}%)
          </span>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                ₹{s.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-zinc-400">
          Live via Angel SmartAPI · updates every 5s
        </p>
      </div>
    </div>
  );
}
