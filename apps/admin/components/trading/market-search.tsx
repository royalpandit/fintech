"use client";

// Markets search — find any stock / index / F&O / etc. via AngelOne symbol search,
// then open its chart or add it to a watchlist. Lives at the top of /user/markets.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch, FiX } from "react-icons/fi";
import AddToWatchlistButton from "@/components/watchlist/add-to-watchlist-button";
import type { WatchlistItem } from "@/components/trading/trading-terminal-types";

type Result = {
  exchange: string;
  tradingSymbol: string;
  symbolName: string;
  instrumentType: string;
  token: string;
};

function toItem(r: Result): WatchlistItem {
  return {
    display: r.symbolName || r.tradingSymbol,
    tradingSymbol: r.tradingSymbol,
    token: r.token,
    exchange: r.exchange,
    type: r.instrumentType || "EQ",
  };
}

export default function MarketSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 1) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/market/search?q=${encodeURIComponent(query)}&exchange=ALL`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (json.ok === false) {
          setError(json.error || "Search is unavailable right now.");
          setResults([]);
        } else {
          const data: Result[] = json.data ?? [];
          setResults(data);
          setError(data.length === 0 && json.message ? json.message : "");
        }
      } catch {
        setError("Network error");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function goChart(r: Result) {
    const params = new URLSearchParams({
      symbol: r.tradingSymbol,
      token: r.token,
      exchange: r.exchange,
      type: r.instrumentType || "EQ",
    });
    router.push(`/user/markets/chart?${params.toString()}`);
  }

  const showDropdown = open && (loading || error !== "" || results.length > 0 || q.trim() !== "");

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 18, maxWidth: 620 }}>
      <FiSearch
        size={16}
        style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
      />
      <input
        type="text"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search stocks, indices, F&O… (RELIANCE, NIFTY, TCS)"
        aria-label="Search markets"
        style={{
          width: "100%",
          padding: "12px 42px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 14,
          outline: "none",
        }}
      />
      {q && (
        <button
          type="button"
          onClick={() => { setQ(""); setResults([]); setError(""); }}
          aria-label="Clear"
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "var(--surface-2)", color: "var(--text-muted)", width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer" }}
        >
          <FiX size={15} />
        </button>
      )}

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 16px 44px rgba(0,0,0,0.16)",
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {loading && <p style={{ margin: 0, padding: "14px 16px", fontSize: 13, color: "var(--text-muted)" }}>Searching…</p>}
          {!loading && error && (
            <p style={{ margin: 0, padding: "14px 16px", fontSize: 13, color: "#dc2626", lineHeight: 1.5 }}>{error}</p>
          )}
          {!loading && !error && results.length === 0 && q.trim() && (
            <p style={{ margin: 0, padding: "14px 16px", fontSize: 13, color: "var(--text-muted)" }}>No matches.</p>
          )}
          {results.map((r) => (
            <div
              key={`${r.exchange}-${r.token}`}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid var(--border)" }}
            >
              <button
                type="button"
                onClick={() => goChart(r)}
                style={{ flex: 1, textAlign: "left", border: "none", background: "none", cursor: "pointer", minWidth: 0, padding: 0 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 13.5, color: "var(--text)" }}>{r.tradingSymbol}</strong>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    {r.exchange}
                  </span>
                </div>
                {r.symbolName && (
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.symbolName}
                  </div>
                )}
              </button>
              <AddToWatchlistButton item={toItem(r)} label="Watchlist" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
