"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = {
  id: number;
  symbol: string;
  asset_type: string;
  notes: string | null;
};

type Props = {
  initialItems: Item[];
};

export default function WatchlistEditor({ initialItems }: Props) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const add = async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return setError("Enter a symbol");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym, assetType: "equity" }),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) {
        setError(data.error || "Could not add");
        return;
      }
      setSymbol("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (sym: string) => {
    setLoading(true);
    try {
      await fetch(`/api/v1/watchlist?symbol=${encodeURIComponent(sym)}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          placeholder="Add symbol (RELIANCE, NIFTY24…)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          style={{
            flex: 1,
            height: 40,
            padding: "0 12px",
            borderRadius: 10,
            border: "1px solid #eef0f4",
            fontSize: 13,
            fontWeight: 600,
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={loading}
          style={{
            padding: "0 18px",
            borderRadius: 10,
            border: "none",
            background: "#0ea5e9",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>
      {error && <p style={{ margin: "0 0 8px", fontSize: 11, color: "#b91c1c" }}>{error}</p>}
      {initialItems.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
          No symbols yet. Add stocks or options you want to track.
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {initialItems.map((i) => (
            <span
              key={i.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 8,
                background: "#f1f5f9",
                fontSize: 12,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {i.symbol}
              <button
                type="button"
                onClick={() => remove(i.symbol)}
                disabled={loading}
                aria-label={`Remove ${i.symbol}`}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
