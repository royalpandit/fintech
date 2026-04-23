"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Initial = {
  title: string;
  content: string;
  marketSymbol: string;
  timeframe: string;
  targetPrice: string;
  stopLossPrice: string;
  disclaimer: string;
};

export default function EditPostForm({ postId, initial }: { postId: number; initial: Initial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [marketSymbol, setMarketSymbol] = useState(initial.marketSymbol);
  const [timeframe, setTimeframe] = useState(initial.timeframe);
  const [targetPrice, setTargetPrice] = useState(initial.targetPrice);
  const [stopLossPrice, setStopLossPrice] = useState(initial.stopLossPrice);
  const [disclaimer, setDisclaimer] = useState(initial.disclaimer);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/v1/advisor/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          marketSymbol: marketSymbol.trim() || null,
          timeframe: timeframe.trim() || null,
          targetPrice: targetPrice ? Number(targetPrice) : null,
          stopLossPrice: stopLossPrice ? Number(stopLossPrice) : null,
          disclaimer: disclaimer.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Update failed");
        setLoading(false);
        return;
      }
      router.push(`/advisor/posts/${postId}`);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <section>
      <Link
        href={`/advisor/posts/${postId}`}
        className="page-subtitle"
        style={{ marginTop: 0, display: "inline-block" }}
      >
        ← Back to post
      </Link>
      <h1 className="page-title">Edit Post</h1>
      <p className="page-subtitle">Saving resets compliance status to pending for re-review.</p>

      <form onSubmit={submit}>
        <article className="card" style={{ marginTop: 16 }}>
          <label className="metric-label">Title *</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={5}
          />

          <label className="metric-label" style={{ marginTop: 16 }}>
            Content *
          </label>
          <textarea
            className="input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            required
            minLength={20}
            style={{ resize: "vertical" }}
          />

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
            <div>
              <label className="metric-label">Symbol</label>
              <input
                className="input"
                value={marketSymbol}
                onChange={(e) => setMarketSymbol(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="metric-label">Timeframe</label>
              <input className="input" value={timeframe} onChange={(e) => setTimeframe(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label className="metric-label">Target</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="metric-label">Stop Loss</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(e.target.value)}
                />
              </div>
            </div>
          </div>

          <label className="metric-label" style={{ marginTop: 16 }}>
            Disclaimer *
          </label>
          <textarea
            className="input"
            value={disclaimer}
            onChange={(e) => setDisclaimer(e.target.value)}
            rows={3}
            required
            minLength={20}
            style={{ resize: "vertical", fontSize: 13 }}
          />

          {error && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 12px",
                background: "#fef2f2",
                color: "#b91c1c",
                borderRadius: 10,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Link
              href={`/advisor/posts/${postId}`}
              className="input"
              style={{ width: "auto", padding: "12px 20px", textDecoration: "none", color: "inherit" }}
            >
              Cancel
            </Link>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </article>
      </form>
    </section>
  );
}
