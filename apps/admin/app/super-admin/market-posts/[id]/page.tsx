const complianceChecks = [
  { title: "No PII Detected", detail: "Personally identifiable information scan cleared.", tone: "success" },
  { title: "SEBI Compliant Disclaimer", detail: "Required financial risk disclosures detected in footer.", tone: "success" },
  { title: "Speculative Language", detail: 'Minor flags for phrases like "guaranteed rebound".', tone: "warning" },
] as const;

const comments = [
  {
    author: "Sarah J. Miller",
    time: "2 hours ago",
    text: "This seems like a pump and dump scheme. You're just trying to offload your bags on retail investors. Completely biased analysis.",
  },
  {
    author: "Daniel Chen",
    time: "4 hours ago",
    text: "Great insights Marcus. Have you looked at the impact of the new regulations on the European cloud providers? Might be a headwind.",
  },
] as const;

export default function MarketPostDetailPage({ params }: { params: { id: string } }) {
  return (
    <section>
      <p className="page-subtitle" style={{ marginTop: 0 }}>
        Market Posts / Post detail #{params.id}
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 className="page-title">MARKET POSTS</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="input" style={{ width: "auto", padding: "10px 14px", fontWeight: 700 }}>
            Hide Post
          </button>
          <button type="button" className="btn-primary" style={{ padding: "10px 14px" }}>
            ★ Feature Post
          </button>
          <button type="button" style={{ borderRadius: 12, border: "0", background: "#be2026", color: "#fff", padding: "10px 16px", fontWeight: 700 }}>
            Delete
          </button>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 14, gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <article className="card" style={{ borderRadius: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "linear-gradient(120deg, #0b1f3a, #6c9fff)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>
                MT
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 32 }}>Marcus Thorne</p>
                <p className="page-subtitle" style={{ margin: 0 }}>
                  Senior Portfolio Advisor • <span style={{ color: "#0b5bb5", fontWeight: 700 }}>Verified</span>
                </p>
              </div>
            </div>
            <p className="page-subtitle" style={{ margin: 0, textAlign: "right" }}>
              Posted on Oct 12, 2023
              <br />
              14:42 GMT
            </p>
          </div>

          <h2 style={{ marginTop: 16, marginBottom: 10, fontSize: 38, lineHeight: "46px", maxWidth: 920 }}>
            Navigating Volatility: Why Tech Stocks Are Primed for a 2024 Rebound
          </h2>
          <p className="page-subtitle" style={{ marginTop: 0, fontSize: 16, lineHeight: "28px" }}>
            After a challenging eighteen months for the NASDAQ, we are seeing structural indicators that suggest a massive rotation back into growth-oriented tech assets. The primary driver? Artificial Intelligence infrastructure spend which is reaching a critical mass.
          </p>
          <p className="page-subtitle" style={{ marginTop: 0, fontSize: 16, lineHeight: "28px" }}>
            While the broader market remains cautious about interest rate trajectories, our internal models suggest that the "high for longer" narrative is already priced into the current valuations of the "Magnificent Seven".
          </p>
          <p style={{ marginTop: 6, marginBottom: 12, fontSize: 16 }}>
            Key sectors to watch: <span style={{ color: "#0b5bb5", fontWeight: 700 }}>#SaaS #FintechRevolutions #AIEthics</span>
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ height: 230, borderRadius: 20, background: "linear-gradient(140deg,#031b34,#0b5bb5)", border: "1px solid #dbe4f4" }} />
            <div style={{ height: 230, borderRadius: 20, background: "linear-gradient(140deg,#0d1626,#274e83)", border: "1px solid #dbe4f4" }} />
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="tag success">❤</span>
              <strong>1.2k</strong>
              <span className="metric-label">LIKES</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="tag">💬</span>
              <strong>342</strong>
              <span className="metric-label">COMMENTS</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="tag">↗</span>
              <strong>89</strong>
              <span className="metric-label">SHARES</span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              {["AR", "SJ", "DC", "+339"].map((badge) => (
                <span key={badge} style={{ width: badge.startsWith("+") ? "auto" : 24, minWidth: 24, height: 24, borderRadius: 999, background: badge.startsWith("+") ? "#eef1f3" : "linear-gradient(120deg,#0058ba,#6c9fff)", color: badge.startsWith("+") ? "var(--text-muted)" : "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, padding: badge.startsWith("+") ? "0 8px" : 0 }}>
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </article>

        <div style={{ display: "grid", gap: 16 }}>
          <article className="card" style={{ borderRadius: 24 }}>
            <h3 style={{ marginTop: 0, letterSpacing: 0.7 }}>AI COMPLIANCE AUDIT</h3>
            <div style={{ marginTop: 8, marginBottom: 10 }}>
              <p className="metric-label" style={{ marginBottom: 6 }}>
                POST SENTIMENT
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#dce7fb", overflow: "hidden" }}>
                  <div style={{ width: "84%", height: "100%", background: "#0b5bb5" }} />
                </div>
                <strong style={{ color: "#0b5bb5" }}>Bullish (84%)</strong>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {complianceChecks.map((check) => (
                <div key={check.title} style={{ borderRadius: 12, border: `1px solid ${check.tone === "warning" ? "#f8d8a8" : "#cce7d8"}`, background: check.tone === "warning" ? "#fff8eb" : "#f7fcf9", padding: 10 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>{check.title}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{check.detail}</p>
                </div>
              ))}
            </div>
            <button type="button" className="input" style={{ width: "100%", marginTop: 10, textAlign: "center", fontWeight: 700 }}>
              View Full AI Report -&gt;
            </button>
          </article>

          <article className="card" style={{ borderRadius: 24 }}>
            <h3 style={{ marginTop: 0, letterSpacing: 1 }}>AUTHOR MANAGEMENT</h3>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: "linear-gradient(120deg,#0b1f3a,#6c9fff)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>
                MT
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 800 }}>Marcus Thorne</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                  Admin since 2021 • <span style={{ color: "#0b5bb5" }}>82 posts</span>
                </p>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <button type="button" className="input" style={{ width: "100%", fontWeight: 700, color: "#0b5bb5" }}>
                ✉ Send Direct Message
              </button>
              <button type="button" className="input" style={{ width: "100%", fontWeight: 700, color: "#7a2ea0" }}>
                ⚠ Issue Official Warning
              </button>
              <button type="button" className="input" style={{ width: "100%", fontWeight: 700, color: "#be2026" }}>
                ⛔ Suspend Author Account
              </button>
            </div>
          </article>

          <article className="card" style={{ borderRadius: 24 }}>
            <h3 style={{ marginTop: 0, letterSpacing: 1 }}>ENGAGEMENT VELOCITY</h3>
            <div style={{ display: "flex", alignItems: "end", gap: 8, height: 86, marginTop: 8 }}>
              {[22, 46, 34, 58, 64, 54, 30, 18].map((h, i) => (
                <div key={i} style={{ width: 18, borderRadius: 6, background: i > 3 && i < 7 ? "#3f7bd9" : "#d2d8e0", height: `${h}px` }} />
              ))}
            </div>
            <p style={{ marginBottom: 0, marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
              Last 24 hours: <span style={{ color: "#0b5bb5", fontWeight: 700 }}>+42% spike in viral reach</span>
            </p>
          </article>
        </div>
      </div>

      <article className="card" style={{ marginTop: 16, borderRadius: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Comment Moderation</h3>
          <span className="tag">342 Total</span>
          <span style={{ marginLeft: "auto", color: "#0b5bb5", fontWeight: 700, fontSize: 13 }}>Newest First</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 13 }}>Flagged Only</span>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {comments.map((comment) => (
            <div key={comment.author} style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 14, background: "#fff" }}>
              <p style={{ margin: 0, fontWeight: 800 }}>
                {comment.author} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)" }}>{comment.time}</span>
              </p>
              <p style={{ margin: "6px 0 0", color: "var(--text-muted)" }}>{comment.text}</p>
            </div>
          ))}
        </div>

        <button type="button" style={{ marginTop: 10, width: "100%", borderRadius: 14, border: "1px dashed #8db2ee", background: "#f9fbff", padding: "12px 14px", color: "#0b5bb5", fontWeight: 700 }}>
          Load 340 more comments
        </button>
      </article>
    </section>
  );
}

