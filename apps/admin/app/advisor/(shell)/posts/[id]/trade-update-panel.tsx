"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TRADE_UPDATE_KINDS, tradeStatusMeta, type TradeUpdateKind } from "@/lib/trades";

// Analyst-facing update options: the timeline kinds plus explicit Exit / Cancel.
const UPDATE_OPTIONS: { value: TradeUpdateKind; label: string }[] = [
  ...TRADE_UPDATE_KINDS,
  { value: "exited", label: "Exit Trade" },
  { value: "cancelled", label: "Cancel Trade" },
];

// Trades Phase 1/3 — advisor logs timeline updates that also move the trade's
// status. See TRADES-PHASE1-2-CHANGES.md.
export default function TradeUpdatePanel({
  postId,
  currentStatus,
}: {
  postId: number;
  currentStatus: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<TradeUpdateKind>("entry_triggered");
  const [note, setNote] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const status = tradeStatusMeta(currentStatus);

  const submit = async () => {
    if (loading) return;
    if (kind === "exited" && !exitPrice) {
      setError("Enter the exit price.");
      return;
    }
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch(`/api/v1/advisor/posts/${postId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          note: note.trim() || undefined,
          exitPrice: kind === "exited" ? Number(exitPrice) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === false) {
        setError(data.error || "Failed to add update");
        return;
      }
      setNote("");
      setExitPrice("");
      setMsg("Update posted to the trade timeline.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Update Trade</h3>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            color: status.tone,
            background: `${status.tone}1f`,
          }}
        >
          {status.label}
        </span>
      </div>
      <p className="page-subtitle" style={{ marginTop: 4 }}>
        Post a timeline update. Some updates also move the trade status (e.g. Entry
        Triggered → Active).
      </p>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <div>
          <label className="metric-label">Update Type</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as TradeUpdateKind)}>
            {UPDATE_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        {kind === "exited" ? (
          <div>
            <label className="metric-label">Exit Price ₹ *</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              placeholder="e.g. 1560"
            />
          </div>
        ) : (
          <div>
            <label className="metric-label">
              {kind === "cancelled" ? "Reason" : "Note (optional)"}
            </label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={kind === "cancelled" ? "Why cancel?" : "e.g. Price reached ₹1,515"}
            />
          </div>
        )}
      </div>
      {kind === "exited" && (
        <div style={{ marginTop: 12 }}>
          <label className="metric-label">Exit Reason</label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Booked profit before target on weak close"
          />
        </div>
      )}

      {error && <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 10 }}>{error}</p>}
      {msg && <p style={{ color: "#047857", fontSize: 13, marginTop: 10 }}>{msg}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Posting…" : "Post Update"}
        </button>
      </div>
    </article>
  );
}
