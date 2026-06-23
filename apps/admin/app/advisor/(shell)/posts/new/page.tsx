"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Audience = "public" | "subscribers";
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
  const [audience, setAudience] = useState<Audience>("public");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [disclaimer, setDisclaimer] = useState(
    "This post is for informational purposes only and does not constitute investment advice. Please consult a qualified financial advisor before making any investment decisions. Past performance is not indicative of future results.",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (scheduleEnabled) {
      if (!scheduledAt) {
        setError("Pick a date and time to schedule this post.");
        return;
      }
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        setError("Scheduled time must be in the future.");
        return;
      }
    }
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
          audience,
          scheduledAt: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
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
                        background: sentiment === s ? `${sentimentColors[s]}22` : "var(--surface)",
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
                  <label className="metric-label">Target Price (₹)</label>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="e.g. 2500.00"
                  />
                </div>
                <div>
                  <label className="metric-label">Stop Loss (₹)</label>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(e.target.value)}
                    placeholder="e.g. 2200.00"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label className="metric-label">Visibility *</label>
              <p style={{ margin: "2px 0 8px", fontSize: 12, color: "var(--text-muted)" }}>
                Who can see this post.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  {
                    id: "public" as const,
                    title: "Public",
                    blurb: "Visible to everyone on the platform.",
                  },
                  {
                    id: "subscribers" as const,
                    title: "Subscribers Only",
                    blurb: "Only users subscribed to you can see this.",
                  },
                ]).map((opt) => {
                  const active = audience === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAudience(opt.id)}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: active ? "2px solid #0ea5e9" : "1px solid var(--border)",
                        background: active ? "var(--primary-soft)" : "var(--surface)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{opt.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{opt.blurb}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                />
                Schedule for later
              </label>
              <p style={{ margin: "2px 0 8px", fontSize: 12, color: "var(--text-muted)" }}>
                Pick a future date and time. The post publishes automatically once approved and the
                time arrives.
              </p>
              {scheduleEnabled && (
                <input
                  className="input"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  style={{ maxWidth: 280 }}
                />
              )}
            </div>

            <label className="metric-label" style={{ marginTop: 16 }}>
              Disclaimer * <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(required by SEBI)</span>
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
                  background: "rgba(239,68,68,0.12)",
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
                {loading
                  ? "Submitting..."
                  : scheduleEnabled
                    ? "Schedule Post"
                    : "Submit for Review"}
              </button>
            </div>
          </article>

          <article className="card">
            <h3 style={{ marginTop: 0 }}>Compliance Checklist</h3>
            <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--text)" }}>
              <li>Do NOT promise guaranteed returns</li>
              <li>Do NOT claim something is "risk-free"</li>
              <li>Do NOT use "insider tip" / "sure shot" language</li>
              <li>Be specific with your reasoning</li>
              <li>Include a disclaimer (automatic below)</li>
              <li>Price targets must have context</li>
            </ul>

            <div style={{ marginTop: 20, padding: 12, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.30)", borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#065f46" }}>
                What happens next
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#047857", lineHeight: 1.6 }}>
                Automated compliance check runs instantly. If the post passes, it moves to admin review (usually under 1 hour). You'll be notified on status change.
              </p>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#0369a1" }}>
                Subscriber visibility
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#0284c7", lineHeight: 1.6 }}>
                Posts set to "Subscribers Only" are exclusively visible to users who have an active subscription to your profile.
              </p>
            </div>
          </article>
        </div>
      </form>
    </section>
  );
}
