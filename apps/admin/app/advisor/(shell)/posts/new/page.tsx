"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AssetType = "equity" | "crypto" | "mf" | "commodity" | "other";
type Sentiment = "bullish" | "bearish" | "neutral";
type RiskLevel = "low" | "medium" | "high";

export default function NewPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("equity");
  const [marketSymbol, setMarketSymbol] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment>("bullish");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [timeframe, setTimeframe] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [disclaimer, setDisclaimer] = useState(
    "This post is for informational purposes only and does not constitute investment advice. Please consult a qualified financial advisor before making any investment decisions. Past performance is not indicative of future results.",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/advisor/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          assetType,
          marketSymbol: marketSymbol.trim() || undefined,
          sentiment,
          riskLevel,
          timeframe: timeframe.trim() || undefined,
          targetPrice: targetPrice ? Number(targetPrice) : undefined,
          stopLossPrice: stopLossPrice ? Number(stopLossPrice) : undefined,
          disclaimer: disclaimer.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed to submit post");
        setLoading(false);
        return;
      }
      router.push(`/advisor/posts/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  const sentimentColors: Record<Sentiment, string> = {
    bullish: "#10b981",
    bearish: "#ef4444",
    neutral: "#64748b",
  };

  return (
    <section>
      <Link href="/advisor/posts" className="page-subtitle" style={{ marginTop: 0, display: "inline-block" }}>
        ← My Posts
      </Link>
      <h1 className="page-title">Post Market Sentiment</h1>
      <p className="page-subtitle">
        Your post goes through automated compliance screening, then admin review before going live.
      </p>

      <form onSubmit={submit}>
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginTop: 16, alignItems: "start" }}>
          <article className="card">
            <label className="metric-label">Title *</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Banking sector showing bullish momentum"
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
              placeholder="Share your analysis. Use concrete reasoning. Avoid guaranteed-return language."
              required
              minLength={20}
              style={{ resize: "vertical" }}
            />

            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
              <div>
                <label className="metric-label">Asset Type *</label>
                <select
                  className="input"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as AssetType)}
                >
                  <option value="equity">Equity</option>
                  <option value="crypto">Crypto</option>
                  <option value="mf">Mutual Fund</option>
                  <option value="commodity">Commodity</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="metric-label">Symbol</label>
                <input
                  className="input"
                  value={marketSymbol}
                  onChange={(e) => setMarketSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFCBANK"
                />
              </div>
              <div>
                <label className="metric-label">Sentiment *</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["bullish", "bearish", "neutral"] as Sentiment[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSentiment(s)}
                      style={{
                        flex: 1,
                        padding: "10px 8px",
                        borderRadius: 8,
                        border: sentiment === s ? `2px solid ${sentimentColors[s]}` : "1px solid var(--border)",
                        background: sentiment === s ? `${sentimentColors[s]}22` : "#fff",
                        color: sentiment === s ? sentimentColors[s] : "var(--text)",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="metric-label">Risk Level *</label>
                <select
                  className="input"
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="metric-label">Timeframe</label>
                <input
                  className="input"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  placeholder="e.g. 3-6 months"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="metric-label">Target Price</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="₹"
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
                    placeholder="₹"
                  />
                </div>
              </div>
            </div>

            <label className="metric-label" style={{ marginTop: 16 }}>
              Disclaimer * <span style={{ color: "#64748b", fontWeight: 400 }}>(required by SEBI)</span>
            </label>
            <textarea
              className="input"
              value={disclaimer}
              onChange={(e) => setDisclaimer(e.target.value)}
              rows={4}
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
                href="/advisor/posts"
                className="input"
                style={{ width: "auto", padding: "12px 20px", textDecoration: "none", color: "inherit" }}
              >
                Cancel
              </Link>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Submitting..." : "Submit for Review"}
              </button>
            </div>
          </article>

          <article className="card">
            <h3 style={{ marginTop: 0 }}>Compliance Checklist</h3>
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8, color: "#334155" }}>
              <li>Do NOT promise guaranteed returns</li>
              <li>Do NOT claim something is "risk-free"</li>
              <li>Do NOT use "insider tip" / "sure shot" language</li>
              <li>Be specific with your reasoning</li>
              <li>Include a disclaimer (automatic below)</li>
              <li>Price targets must have context</li>
            </ul>

            <div style={{ marginTop: 20, padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#065f46" }}>
                What happens next
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#047857", lineHeight: 1.6 }}>
                Automated compliance check runs instantly. If the post passes, it moves to admin review (usually under 1 hour). You'll be notified on status change.
              </p>
            </div>
          </article>
        </div>
      </form>
    </section>
  );
}
