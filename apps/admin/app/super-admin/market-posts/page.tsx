import Link from "next/link";

const summary = [
  { label: "Total Posts", value: "865", color: "#2563eb" },
  { label: "Published", value: "720", color: "#10b981" },
  { label: "Flagged", value: "45", color: "#ef4444" },
  { label: "Pending", value: "100", color: "#f59e0b" },
] as const;

const flaggedPosts = [
  { id: "82910", title: "Huge Surge in Tech Stocks?", author: "Mukesh Banna", time: "2 hours ago" },
  { id: "82911", title: "OTE: Buy or Sell?", author: "Anjali Desai", time: "5 hours ago" },
  { id: "82912", title: "Crypto Bull Run Incoming?", author: "Nikhil Sharma", time: "1 day" },
  { id: "82913", title: "Housing Market Collapse?", author: "Kamal Khanna", time: "2 days ago" },
] as const;

const aiReasons = [
  { reason: "Investment Advice without Disclaimer", time: "2 hours ago" },
  { reason: "Possible Pump-and-Dump Scheme", time: "4 hours ago" },
  { reason: "Use of Offensive Language", time: "1 day ago" },
] as const;

export default function MarketPostsPage() {
  return (
    <section>
      <h1 className="page-title">MARKET POSTS</h1>
      <p className="page-subtitle">Moderation overview for published, flagged, and pending market content.</p>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        {summary.map((item) => (
          <article key={item.label} className="card" style={{ borderRadius: 14, padding: 16 }}>
            <p className="metric-label" style={{ marginTop: 0 }}>
              {item.label}
            </p>
            <p className="metric-value" style={{ fontSize: 42, margin: "8px 0 0" }}>
              {item.value}
            </p>
            <div style={{ marginTop: 8, height: 6, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
              <div style={{ width: "72%", height: "100%", background: item.color }} />
            </div>
          </article>
        ))}
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "2fr 1fr" }}>
        <article className="card" style={{ borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Post Trends</h3>
          <div style={{ height: 300, border: "1px solid var(--border)", borderRadius: 12, background: "#fbfdff", overflow: "hidden", position: "relative" }}>
            <svg viewBox="0 0 900 300" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
              <polyline points="35,230 130,196 220,156 310,136 400,152 490,124 580,108 670,96 760,84 850,68" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
              <polyline points="35,246 130,228 220,196 310,190 400,162 490,184 580,162 670,170 760,154 850,180" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", left: 18, right: 18, bottom: 10, display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: 11, fontWeight: 700 }}>
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#3b82f6" }} /> Published
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#f59e0b" }} /> Flagged
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#10b981" }} /> Pending
            </span>
          </div>
        </article>

        <div style={{ display: "grid", gap: 16 }}>
          <article className="card" style={{ borderRadius: 14 }}>
            <h3 style={{ marginTop: 0 }}>Content Moderation</h3>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                <p className="metric-label" style={{ margin: 0 }}>
                  Pending Review
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 800 }}>18</p>
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                <p className="metric-label" style={{ margin: 0 }}>
                  Approved Posts
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 800 }}>56</p>
              </div>
            </div>
            <button type="button" className="btn-primary" style={{ width: "100%", marginTop: 10 }}>
              Review All
            </button>
          </article>

          <article className="card" style={{ borderRadius: 14 }}>
            <h3 style={{ marginTop: 0 }}>Recent Flagged Posts</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {flaggedPosts.map((post) => (
                <div key={post.title} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      <Link href={`/super-admin/market-posts/${post.id}`} style={{ color: "var(--text)" }}>
                        {post.title}
                      </Link>
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{post.author}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{post.time}</p>
                    <Link href={`/super-admin/market-posts/${post.id}`} className="btn-primary" style={{ marginTop: 4, borderRadius: 8, padding: "6px 10px", display: "inline-block" }}>
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "2fr 1fr" }}>
        <article className="card" style={{ borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>Recent Flagged Posts</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Author</th>
                  <th>Reported</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {flaggedPosts.map((post) => (
                  <tr key={`table-${post.title}`}>
                    <td>
                      <Link href={`/super-admin/market-posts/${post.id}`} style={{ color: "var(--primary)", fontWeight: 700 }}>
                        {post.title}
                      </Link>
                    </td>
                    <td>{post.author}</td>
                    <td>{post.time}</td>
                    <td>
                      <Link href={`/super-admin/market-posts/${post.id}`} className="btn-primary" style={{ marginRight: 8, borderRadius: 8, padding: "6px 10px", display: "inline-block" }}>
                        Review
                      </Link>
                      <button type="button" style={{ border: 0, borderRadius: 8, background: "#fee2e2", color: "#b91c1c", padding: "6px 10px", fontWeight: 700 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card" style={{ borderRadius: 14 }}>
          <h3 style={{ marginTop: 0 }}>AI Flagging Reasons</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {aiReasons.map((row) => (
              <div key={row.reason} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>⚠ {row.reason}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{row.time}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="card" style={{ marginTop: 16, borderRadius: 14 }}>
        <h3 style={{ marginTop: 0 }}>Recent Approved Posts</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Weekly Market Analysis</td>
                <td>Rahul Verma</td>
                <td>Today</td>
              </tr>
              <tr>
                <td>ABC Corp Earnings Report</td>
                <td>Vikram Suri</td>
                <td>1 day ago</td>
              </tr>
              <tr>
                <td>AI Stocks Outlook</td>
                <td>Minal Joshi</td>
                <td>2 days ago</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

