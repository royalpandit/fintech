"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import PostAccessSelector from "@/components/posts/post-access-selector";
import BoostPicker from "@/components/posts/boost-picker";
import RecipientPicker from "@/components/posts/recipient-picker";
import type { PostAccessType } from "@/lib/post-access";
import type { BoostTierId } from "@/lib/post-boost";
import { TRADE_TIMEFRAMES, withGst, type TradeTimeframe } from "@/lib/trades";
import { uploadSocialFile } from "@/lib/community-client";

type Audience = "public" | "subscribers" | "custom";

type AssetType =
  | "equity"
  | "futures"
  | "options"
  | "commodity"
  | "currency"
  | "crypto"
  | "mf"
  | "other";
type Sentiment = "bullish" | "bearish" | "neutral";
type RiskLevel = "low" | "medium" | "high";
type EntryType = "market" | "exact" | "range";

export default function NewPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("equity");
  const [marketSymbol, setMarketSymbol] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [sentiment, setSentiment] = useState<Sentiment>("bullish");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [timeframe, setTimeframe] = useState("");
  const [timeframeType, setTimeframeType] = useState<TradeTimeframe | "">("");
  const [conviction, setConviction] = useState(0);
  const [entryType, setEntryType] = useState<EntryType>("range");
  const [entryMin, setEntryMin] = useState("");
  const [entryMax, setEntryMax] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [chartImages, setChartImages] = useState<string[]>([]);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [postAccessType, setPostAccessType] = useState<PostAccessType>("free");
  const [unlockPrice, setUnlockPrice] = useState("");
  const [boostTier, setBoostTier] = useState<BoostTierId | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  // Two top-level choices. When "subscribers" is picked, shareAll=true sends to
  // all subscribers; shareAll=false sends only to the picked recipients.
  const [audienceTop, setAudienceTop] = useState<"public" | "subscribers">("public");
  const [shareAll, setShareAll] = useState(true);
  const [recipientIds, setRecipientIds] = useState<number[]>([]);
  // Publish-to-service: analyst's services + the ones this post targets.
  const [services, setServices] = useState<{ id: number; name: string }[]>([]);
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  useEffect(() => {
    fetch("/api/v1/advisor/services")
      .then((r) => r.json())
      .then((d) => setServices((d.data ?? []).map((s: { id: number; name: string }) => ({ id: s.id, name: s.name }))))
      .catch(() => setServices([]));
  }, []);
  const toggleService = (id: number) =>
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const [disclaimer, setDisclaimer] = useState(
    "This post is for informational purposes only and does not constitute investment advice. Please consult a qualified financial advisor before making any investment decisions. Past performance is not indicative of future results.",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Map the UI choices to the backend audience value.
  const audience: Audience =
    audienceTop === "public" ? "public" : shareAll ? "subscribers" : "custom";

  const onChartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files?.length) return;
    setUploadingChart(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        urls.push(await uploadSocialFile(file, "image"));
      }
      setChartImages((prev) => [...prev, ...urls].slice(0, 6));
    } catch {
      setError("Chart upload failed");
    } finally {
      setUploadingChart(false);
    }
  };

  const doSubmit = async (asDraft: boolean) => {
    setError("");

    if (!asDraft) {
      if (postAccessType === "paid" && (!unlockPrice || Number(unlockPrice) <= 0)) {
        setError("Set an unlock price for a paid post.");
        return;
      }
      if (audience === "custom" && recipientIds.length === 0 && serviceIds.length === 0) {
        setError("Pick a service or at least one person to send this post to.");
        return;
      }
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
    }
    if (asDraft) setSavingDraft(true);
    else setLoading(true);

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
          timeframeType: timeframeType || undefined,
          exchange: exchange.trim() || undefined,
          entryType,
          entryPriceMin: entryMin ? Number(entryMin) : undefined,
          entryPriceMax: entryType === "range" && entryMax ? Number(entryMax) : undefined,
          conviction: conviction || undefined,
          imageUrls: chartImages.length ? chartImages : undefined,
          targetPrice: targetPrice ? Number(targetPrice) : undefined,
          stopLossPrice: stopLossPrice ? Number(stopLossPrice) : undefined,
          disclaimer: disclaimer.trim(),
          postAccessType,
          unlockPrice: postAccessType === "paid" && unlockPrice ? Number(unlockPrice) : undefined,
          boostTier: boostTier || undefined,
          audience,
          recipientUserIds: audience === "custom" ? recipientIds : undefined,
          serviceIds:
            audienceTop === "subscribers" && !shareAll && serviceIds.length ? serviceIds : undefined,
          scheduledAt:
            !asDraft && scheduleEnabled && scheduledAt
              ? new Date(scheduledAt).toISOString()
              : undefined,
          saveDraft: asDraft,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        setError(data.error || "Failed to submit post");
        setLoading(false);
        setSavingDraft(false);
        return;
      }
      router.push(`/advisor/posts/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
      setSavingDraft(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void doSubmit(false);
  };

  const sentimentColors: Record<Sentiment, string> = {
    bullish: "#10b981",
    bearish: "#ef4444",
    neutral: "#64748b",
  };

  return (
    <section style={{ maxWidth: 1080, margin: "0 auto" }}>
      <Link href="/advisor/posts" className="user-page-back-link" style={{ marginBottom: 8 }}>
        <span className="user-page-back-icon"><FiArrowLeft size={14} /></span>
        My Posts
      </Link>
      <h1 className="page-title">Post Market Sentiment</h1>
      <p className="page-subtitle">
        Your post goes through automated compliance screening, then admin review before going live.
      </p>

      <form onSubmit={submit}>
        <div className="grid" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", gap: 20, marginTop: 16, alignItems: "start" }}>
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
                  <option value="equity">Stocks</option>
                  <option value="futures">Futures</option>
                  <option value="options">Options</option>
                  <option value="commodity">Commodity</option>
                  <option value="currency">Currency</option>
                  <option value="crypto">Crypto</option>
                  <option value="mf">Mutual Fund</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="metric-label">Symbol</label>
                <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8 }}>
                  <select
                    className="input"
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value)}
                    aria-label="Exchange"
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                    <option value="MCX">MCX</option>
                    <option value="NFO">NFO</option>
                    <option value="CDS">CDS</option>
                  </select>
                  <input
                    className="input"
                    value={marketSymbol}
                    onChange={(e) => setMarketSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFCBANK"
                  />
                </div>
              </div>
              <div>
                <label className="metric-label">Recommendation *</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {([
                    { id: "bullish", label: "BUY" },
                    { id: "bearish", label: "SELL" },
                    { id: "neutral", label: "Neutral" },
                  ] as { id: Sentiment; label: string }[]).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSentiment(s.id)}
                      style={{
                        flex: 1,
                        padding: "10px 8px",
                        borderRadius: 8,
                        border: sentiment === s.id ? `2px solid ${sentimentColors[s.id]}` : "1px solid var(--border)",
                        background: sentiment === s.id ? `${sentimentColors[s.id]}22` : "var(--surface)",
                        color: sentiment === s.id ? sentimentColors[s.id] : "var(--text)",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {s.label}
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
                <label className="metric-label">Horizon</label>
                <select
                  className="input"
                  value={timeframeType}
                  onChange={(e) => setTimeframeType(e.target.value as TradeTimeframe | "")}
                >
                  <option value="">Not set</option>
                  {TRADE_TIMEFRAMES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
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

              {/* Entry type + range (Trades Phase 1/3) */}
              <div>
                <label className="metric-label">Entry Type</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {([
                    { id: "market", label: "Market Price" },
                    { id: "exact", label: "Exact Price" },
                    { id: "range", label: "Price Range" },
                  ] as { id: EntryType; label: string }[]).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEntryType(t.id)}
                      style={{
                        flex: 1,
                        padding: "9px 6px",
                        borderRadius: 8,
                        border: entryType === t.id ? "2px solid #0ea5e9" : "1px solid var(--border)",
                        background: entryType === t.id ? "var(--primary-soft)" : "var(--surface)",
                        color: entryType === t.id ? "var(--primary)" : "var(--text)",
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {entryType !== "market" && (
                <div style={{ display: "grid", gridTemplateColumns: entryType === "range" ? "1fr 1fr" : "1fr", gap: 8 }}>
                  <div>
                    <label className="metric-label">{entryType === "range" ? "Entry From ₹" : "Entry ₹"}</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={entryMin}
                      onChange={(e) => setEntryMin(e.target.value)}
                      placeholder="e.g. 1510"
                    />
                  </div>
                  {entryType === "range" && (
                    <div>
                      <label className="metric-label">Entry To ₹</label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        value={entryMax}
                        onChange={(e) => setEntryMax(e.target.value)}
                        placeholder="e.g. 1520"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Conviction (Trades Phase 2) */}
              <div>
                <label className="metric-label">Conviction</label>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setConviction(conviction === n ? 0 : n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontSize: 22,
                        lineHeight: 1,
                        color: n <= conviction ? "#f59e0b" : "var(--border)",
                        padding: 0,
                      }}
                    >
                      ★
                    </button>
                  ))}
                  {conviction > 0 && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>
                      {conviction}/5
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Chart screenshots (Trades Phase 2) */}
            <div style={{ marginTop: 16 }}>
              <label className="metric-label">Chart screenshots (optional)</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {chartImages.map((url) => (
                  <div key={url} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setChartImages((prev) => prev.filter((u) => u !== url))}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: "none",
                        background: "#dc2626",
                        color: "#fff",
                        fontSize: 12,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {chartImages.length < 6 && (
                  <label
                    className="input"
                    style={{ width: "auto", padding: "10px 16px", cursor: uploadingChart ? "wait" : "pointer", fontSize: 13, fontWeight: 600 }}
                  >
                    {uploadingChart ? "Uploading…" : "+ Add chart"}
                    <input type="file" accept="image/*" multiple hidden disabled={uploadingChart} onChange={onChartUpload} />
                  </label>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <PostAccessSelector value={postAccessType} onChange={setPostAccessType} variant="form" />
              {postAccessType === "paid" && (
                <div style={{ marginTop: 12 }}>
                  <label className="metric-label">Unlock Price ₹ *</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={unlockPrice}
                    onChange={(e) => setUnlockPrice(e.target.value)}
                    placeholder="e.g. 99"
                    style={{ maxWidth: 200 }}
                  />
                  {unlockPrice && Number(unlockPrice) > 0 && (
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                      Subscribers pay ₹{unlockPrice} + 18% GST = ₹{withGst(Number(unlockPrice))}.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <label className="metric-label">Audience *</label>
              <p style={{ margin: "2px 0 8px", fontSize: 12, color: "var(--text-muted)" }}>
                Who can see this post.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  { id: "public", title: "Public", blurb: "Visible to everyone." },
                  { id: "subscribers", title: "Subscribers", blurb: "Send to your subscribers." },
                ] as const).map((opt) => {
                  const active = audienceTop === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAudienceTop(opt.id)}
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

              {audienceTop === "subscribers" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    background: "var(--surface-2)",
                  }}
                >
                  {/* Share-all vs pick-specific toggle */}
                  <div style={{ display: "flex", gap: 8, marginBottom: shareAll ? 0 : 12 }}>
                    {([
                      { id: true, label: "Share with all" },
                      { id: false, label: "Choose specific people" },
                    ] as const).map((opt) => {
                      const active = shareAll === opt.id;
                      return (
                        <button
                          key={String(opt.id)}
                          type="button"
                          onClick={() => setShareAll(opt.id)}
                          style={{
                            flex: 1,
                            padding: "9px 0",
                            borderRadius: 8,
                            border: active ? "2px solid #0ea5e9" : "1px solid var(--border)",
                            background: active ? "var(--surface)" : "var(--surface)",
                            color: active ? "var(--primary)" : "var(--text)",
                            fontWeight: 700,
                            fontSize: 12.5,
                            cursor: "pointer",
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {!shareAll && services.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <label className="metric-label">Or publish to a service</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {services.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleService(s.id)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 999,
                              border: serviceIds.includes(s.id) ? "1px solid #0ea5e9" : "1px solid var(--border)",
                              background: serviceIds.includes(s.id) ? "var(--primary-soft)" : "var(--surface)",
                              color: serviceIds.includes(s.id) ? "var(--primary)" : "var(--text)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                        Selecting services sends only to those subscribers (overrides the people picker below).
                      </p>
                    </div>
                  )}

                  {!shareAll && serviceIds.length === 0 && (
                    <RecipientPicker selected={recipientIds} onChange={setRecipientIds} />
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <label className="metric-label">Boost this post (optional)</label>
              <p style={{ margin: "2px 0 8px", fontSize: 12, color: "var(--text-muted)" }}>
                Promote your post to the top of the feed. Boost activates once the post is approved.
              </p>
              <BoostPicker selected={boostTier} onSelect={setBoostTier} includeNone />
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
              <button
                type="button"
                className="input"
                style={{ width: "auto", padding: "12px 20px", cursor: "pointer", fontWeight: 600 }}
                onClick={() => void doSubmit(true)}
                disabled={loading || savingDraft}
              >
                {savingDraft ? "Saving…" : "Save Draft"}
              </button>
              <button type="submit" className="btn-primary" disabled={loading || savingDraft}>
                {loading
                  ? "Submitting..."
                  : scheduleEnabled
                    ? "Schedule Post"
                    : "Submit for Review"}
              </button>
            </div>
          </article>

          <article className="card" style={{ position: "sticky", top: 80, alignSelf: "start" }}>
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
          </article>
        </div>
      </form>
    </section>
  );
}
