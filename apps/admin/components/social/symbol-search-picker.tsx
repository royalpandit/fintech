"use client";

import { useEffect, useRef, useState } from "react";
import type { AttachedSymbol } from "./attached-symbol-card";

type SearchRow = {
  exchange: string;
  tradingSymbol: string;
  symbolName: string;
  token: string;
};

function normalizeSymbol(row: SearchRow): AttachedSymbol {
  const sym = (row.symbolName || row.tradingSymbol)
    .replace(/-EQ$/i, "")
    .replace(/\.(NS|BO)$/i, "")
    .split("-")[0]
    .toUpperCase();
  return {
    symbol: sym,
    tradingSymbol: row.tradingSymbol,
    exchange: row.exchange,
    token: row.token,
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
  const [results, setResults] = useState<AttachedSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  // const [error, setError] = useState(""); // see KNOWN-ISSUES.md (market search)
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.length < 1) {
      setResults([]);
      // setError("");
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      // setError("");
      try {
        const res = await fetch(
          `/api/v1/market/search?q=${encodeURIComponent(q)}&exchange=ALL`,
          { cache: "no-store" },
        );
        const json = await res.json();
        // NOTE: error surfacing commented out pending report — see KNOWN-ISSUES.md.
        // The API returns { ok: false, error } when AngelOne env vars are missing,
        // which currently shows as a plain "No symbols found".
        // if (json.ok === false) {
        //   setError(json.error || "Symbol search is unavailable right now.");
        //   setResults([]);
        //   return;
        // }
        const rows: SearchRow[] = json.data ?? [];
        setResults(rows.slice(0, 12).map(normalizeSymbol));
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
        {/* Error message commented out pending report — see KNOWN-ISSUES.md
        {!loading && error && (
          <p className="sf-picker-empty" style={{ color: "#dc2626", lineHeight: 1.5 }}>
            {error}
          </p>
        )}
        */}
        {!loading && q && results.length === 0 && (
          <p className="sf-picker-empty">No symbols found</p>
        )}
        {results.map(r => (
          <button
            key={`${r.exchange}-${r.token}`}
            type="button"
            className="sf-symbol-picker-row"
            onClick={() => {
              onSelect(r);
              onClose();
            }}
          >
            <span className="sym">${r.symbol}</span>
            <span className="meta">{r.tradingSymbol}</span>
            <span className="exch">{r.exchange}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
