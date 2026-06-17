"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/client/fetch-api";

interface OptionChainPanelProps {
  symbolQuery: string;
  refreshKey: number;
}

interface ChainRow {
  strike: number;
  ce?: GreekSide;
  pe?: GreekSide;
}

interface GreekSide {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  volume: number;
}

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function OptionChainPanel({
  symbolQuery,
  refreshKey,
}: OptionChainPanelProps) {
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry] = useState("");
  const [chain, setChain] = useState<ChainRow[]>([]);
  const [spot, setSpot] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const expiryRef = useRef(expiry);

  expiryRef.current = expiry;

  const fetchChain = useCallback(
    async (symbol: string, expiryDate: string, silent = false) => {
      if (!expiryDate) return;

      if (!silent) setLoading(true);
      setError(null);

      try {
        const [chainJson, ltpJson] = await Promise.all([
          fetchApi<{ chain: ChainRow[] }>(
            `/api/smartapi/option-chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiryDate)}`,
          ),
          fetchApi<{ quote: { ltp: number } }>(
            `/api/smartapi/ltp?symbol=${encodeURIComponent(symbol)}`,
          ).catch(() => null),
        ]);

        setChain(chainJson.chain ?? []);
        if (ltpJson?.quote?.ltp) {
          setSpot(ltpJson.quote.ltp);
        }
        setLastUpdated(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
        setChain([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [],
  );

  const initForSymbol = useCallback(async () => {
    setLoading(true);
    setError(null);
    setChain([]);
    setSpot(null);

    try {
      const json = await fetchApi<{ expiries: string[] }>(
        `/api/smartapi/expiries?symbol=${encodeURIComponent(symbolQuery)}`,
      );

      const list: string[] = json.expiries ?? [];
      setExpiries(list);

      if (list.length === 0) {
        setError(
          `No F&O expiries for "${symbolQuery}". Try NIFTY, BANKNIFTY, or RELIANCE.`,
        );
        setLoading(false);
        return;
      }

      const nearest = list[0];
      setExpiry(nearest);
      await fetchChain(symbolQuery, nearest, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [symbolQuery, fetchChain]);

  useEffect(() => {
    initForSymbol();
  }, [symbolQuery, refreshKey, initForSymbol]);

  useEffect(() => {
    if (!expiry) return;

    const poll = setInterval(() => {
      fetchChain(symbolQuery, expiryRef.current, true);
    }, 5000);

    return () => clearInterval(poll);
  }, [symbolQuery, expiry, fetchChain]);

  const handleExpiryChange = (next: string) => {
    setExpiry(next);
    fetchChain(symbolQuery, next);
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Expiry
          <select
            value={expiry}
            onChange={(e) => handleExpiryChange(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 outline-none focus:border-[#4a69bd] focus:ring-2 focus:ring-[#4a69bd]/20"
          >
            {expiries.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => fetchChain(symbolQuery, expiry)}
          className="rounded-lg bg-[#4a69bd] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d58a8]"
        >
          Refresh
        </button>
        {spot !== null && (
          <span className="text-sm font-semibold text-zinc-800">
            Spot ₹{fmt(spot)}
          </span>
        )}
        <span className="text-xs text-zinc-500">
          Live · refreshes every 5s
          {lastUpdated &&
            ` · ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
        </span>
      </div>

      {loading && chain.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-[#4a69bd]" />
        </div>
      )}

      {error && chain.length === 0 && !loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-600">
          <p>{error}</p>
          <p className="text-xs text-zinc-500">
            Option chain needs an F&amp;O underlying (e.g. NIFTY, RELIANCE).
            Data is best during NSE market hours (9:15–15:30 IST).
          </p>
        </div>
      )}

      {chain.length > 0 && (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <tr>
                <th
                  colSpan={4}
                  className="border-b border-r border-zinc-200 bg-emerald-50/80 px-2 py-2 text-center text-emerald-800"
                >
                  CALL (CE)
                </th>
                <th className="border-b border-zinc-200 bg-zinc-200 px-3 py-2 text-center">
                  Strike
                </th>
                <th
                  colSpan={4}
                  className="border-b border-l border-zinc-200 bg-red-50/80 px-2 py-2 text-center text-red-800"
                >
                  PUT (PE)
                </th>
              </tr>
              <tr>
                <th className="border-b border-zinc-200 px-2 py-1.5">IV</th>
                <th className="border-b border-zinc-200 px-2 py-1.5">Δ</th>
                <th className="border-b border-zinc-200 px-2 py-1.5">Vol</th>
                <th className="border-b border-r border-zinc-200 px-2 py-1.5">
                  Θ
                </th>
                <th className="border-b border-zinc-200 bg-zinc-200" />
                <th className="border-b border-zinc-200 px-2 py-1.5">IV</th>
                <th className="border-b border-zinc-200 px-2 py-1.5">Δ</th>
                <th className="border-b border-zinc-200 px-2 py-1.5">Vol</th>
                <th className="border-b border-l border-zinc-200 px-2 py-1.5">
                  Θ
                </th>
              </tr>
            </thead>
            <tbody>
              {chain.map((row) => (
                <tr
                  key={row.strike}
                  className="border-b border-zinc-100 bg-white hover:bg-zinc-50"
                >
                  <td className="px-2 py-2 text-right text-zinc-700">
                    {row.ce ? fmt(row.ce.iv) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-700">
                    {row.ce ? fmt(row.ce.delta) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-600">
                    {row.ce
                      ? Math.round(row.ce.volume).toLocaleString("en-IN")
                      : "—"}
                  </td>
                  <td className="border-r border-zinc-100 px-2 py-2 text-right text-zinc-600">
                    {row.ce ? fmt(row.ce.theta) : "—"}
                  </td>
                  <td className="bg-zinc-100 px-3 py-2 text-center font-semibold text-zinc-900">
                    {fmt(row.strike, 0)}
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-700">
                    {row.pe ? fmt(row.pe.iv) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-700">
                    {row.pe ? fmt(row.pe.delta) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-600">
                    {row.pe
                      ? Math.round(row.pe.volume).toLocaleString("en-IN")
                      : "—"}
                  </td>
                  <td className="border-l border-zinc-100 px-2 py-2 text-right text-zinc-600">
                    {row.pe ? fmt(row.pe.theta) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
