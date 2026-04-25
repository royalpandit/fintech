"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Sentiment = "bullish" | "bearish";

const DEFAULT_DISCLAIMER =
  "This sentiment is for informational purposes only and does not constitute investment advice. Please consult a qualified financial advisor before making any investment decisions. Past performance is not indicative of future results.";

export default function QuickPost() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment>("bullish");
  const [targetPrice, setTargetPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setSymbol("");
    setTargetPrice("");
    setNote("");
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const trimSymbol = symbol.trim().toUpperCase();
    const trimNote = note.trim();

    if (!trimSymbol) {
      setError("Stock symbol is required");
      return;
    }
    if (trimNote.length < 20) {
      setError("Reasoning must be at least 20 characters (regulatory requirement)");
      return;
    }

    setLoading(true);
    try {
      const title = `${sentiment === "bullish" ? "Bullish" : "Bearish"} view on ${trimSymbol}`;
      const response = await fetch("/api/v1/advisor/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: trimNote,
          assetType: "equity",
          marketSymbol: trimSymbol,
          sentiment,
          riskLevel: "medium",
          targetPrice: targetPrice ? Number(targetPrice) : undefined,
          disclaimer: DEFAULT_DISCLAIMER,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed to submit post");
        setLoading(false);
        return;
      }

      const flagged = data.flagged === true;
      setSuccess(
        flagged
          ? "Submitted, but auto-flagged for compliance review."
          : "Submitted! Pending admin review.",
      );
      reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="widget">
      <div className="widget-title">
        <h3>Quick Post</h3>
        <Link href="/advisor/posts/new">Full editor →</Link>
      </div>

      <form onSubmit={submit}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            display: "block",
            marginBottom: 4,
          }}
        >
          Select Stock
        </label>
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="e.g. RELIANCE"
          required
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid #eef0f4",
            background: "#fff",
            fontSize: 12,
            color: "#334155",
            outline: "none",
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
          }}
        />

        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            display: "block",
            marginBottom: 4,
          }}
        >
          Sentiment
        </label>
        <div className="bs-toggle" style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setSentiment("bullish")}
            className={`bs-toggle-item buy ${sentiment === "bullish" ? "active" : ""}`}
          >
            Bullish
          </button>
          <button
            type="button"
            onClick={() => setSentiment("bearish")}
            className={`bs-toggle-item sell ${sentiment === "bearish" ? "active" : ""}`}
          >
            Bearish
          </button>
        </div>

        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            display: "block",
            marginBottom: 4,
          }}
        >
          Target Price (optional)
        </label>
        <input
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          type="number"
          step="0.01"
          min={0}
          placeholder="₹"
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid #eef0f4",
            background: "#fff",
            fontSize: 12,
            color: "#334155",
            outline: "none",
            marginBottom: 12,
          }}
        />

        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            display: "block",
            marginBottom: 4,
          }}
        >
          Reasoning <span style={{ color: "#94a3b8" }}>· min 20 chars</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why this sentiment? Avoid 'guaranteed return' language."
          rows={3}
          required
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #eef0f4",
            background: "#fff",
            fontSize: 12,
            color: "#334155",
            outline: "none",
            marginBottom: 4,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        <div
          style={{
            fontSize: 10,
            color: note.length >= 20 ? "#16a34a" : "#94a3b8",
            textAlign: "right",
            marginBottom: 12,
          }}
        >
          {note.length} / 20+
        </div>

        {error && (
          <div
            style={{
              padding: "8px 10px",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 8,
              fontSize: 11,
              marginBottom: 10,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: "8px 10px",
              background: "#f0fdf4",
              color: "#047857",
              borderRadius: 8,
              fontSize: 11,
              marginBottom: 10,
              fontWeight: 600,
            }}
          >
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="cta-place"
          style={{ opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Submitting..." : "Post Sentiment"}
        </button>

        <p
          style={{
            margin: "8px 0 0",
            fontSize: 10,
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Auto-flags for compliance · Admin review required before publish
        </p>
      </form>
    </article>
  );
}
