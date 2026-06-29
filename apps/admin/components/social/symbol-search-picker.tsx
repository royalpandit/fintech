"use client";

import { useEffect, useRef, useState } from "react";
import { resolveMarketExchange } from "@/lib/angelone-shared";
import type { AttachedSymbol } from "./attached-symbol-card";

type SearchRow = {
  exchange: string;
  tradingSymbol: string;
  symbolName: string;
  token: string;
  instrumentType?: string;
};

function displayTitle(row: SearchRow): string {
  const raw = (row.symbolName || row.tradingSymbol).replace(/-EQ$/i, "").trim();
  if (row.instrumentType === "EQ" || row.tradingSymbol.endsWith("-EQ")) {
    return raw.split("-")[0].toUpperCase();
  }
  return raw;
}

function normalizeSymbol(row: SearchRow): AttachedSymbol {
  const instrumentType = row.instrumentType || "EQ";
  const exchange = resolveMarketExchange({
    exchange: row.exchange,
    symboltoken: row.token,
    tradingSymbol: row.tradingSymbol,
    instrumentType,
  });
  return {
    symbol: displayTitle(row),
    tradingSymbol: row.tradingSymbol,
    exchange,
    token: row.token,
    instrumentType,
  };
}

export default function SymbolSearchPicker({
  onSelect,
  onClose,
}: {
  onSelect: (sym: AttachedSymbol) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/market/search?q=${encodeURIComponent(q)}&exchange=ALL`,
          { cache: "no-store" },
        );
        const json = await res.json();
        const rows: SearchRow[] = json.data ?? [];
        setResults(rows.slice(0, 12));
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  return (
    <div className="sf-symbol-picker" ref={ref} role="dialog">
      <input
        type="search"
        className="sf-symbol-picker-search"
        placeholder="Search symbol (NIFTY, TCS, RELIANCE…)"
        value={q}
        onChange={e => setQ(e.target.value)}
        autoFocus
      />
      <div className="sf-symbol-picker-list">
        {loading && <p className="sf-picker-empty">Searching…</p>}
        {!loading && q && results.length === 0 && (
          <p className="sf-picker-empty">No symbols found</p>
        )}
        {results.map(r => (
          <button
            key={`${r.exchange}-${r.token}`}
            type="button"
            className="sf-symbol-picker-row"
            onClick={() => {
              onSelect(normalizeSymbol(r));
              onClose();
            }}
          >
            <div className="sf-symbol-picker-row-main">
              <span className="sf-symbol-picker-title">${displayTitle(r)}</span>
              <span className="sf-symbol-picker-sub">{r.tradingSymbol}</span>
            </div>
            <span className="sf-symbol-picker-exch">{r.exchange}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
