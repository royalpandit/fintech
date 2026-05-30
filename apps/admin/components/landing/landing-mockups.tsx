/** Static UI mockups matching the Finuer landing design */

export function DashboardMock() {
  return (
    <div className="lp-dashboard-mock">
      <div style={{ display: "flex", minHeight: 320 }}>
        <aside style={{ width: 56, borderRight: "1px solid #eef0f4", background: "#fafafa", padding: "12px 8px" }}>
          {["▦", "◇", "◎", "◉", "☰"].map((ic, i) => (
            <div key={i} style={{ width: 36, height: 36, borderRadius: 8, background: i === 0 ? "#0f172a" : "#f1f5f9", color: i === 0 ? "#fff" : "#94a3b8", display: "grid", placeItems: "center", fontSize: 12, marginBottom: 8 }}>{ic}</div>
          ))}
        </aside>
        <div style={{ flex: 1, padding: 16 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Good morning,</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Rohan 👋</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ border: "1px solid #eef0f4", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#64748b" }}>Total Portfolio</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>₹12,45,890</div>
              <div style={{ fontSize: 9, color: "#16a34a", fontWeight: 700 }}>+2.4%</div>
              <div style={{ height: 24, marginTop: 6, background: "linear-gradient(90deg, #bbf7d0, #86efac)", borderRadius: 4, opacity: 0.7 }} />
            </div>
            <div style={{ border: "1px solid #eef0f4", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#64748b" }}>Today&apos;s P&L</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#16a34a" }}>+₹18,420</div>
              <div style={{ height: 24, marginTop: 14, background: "linear-gradient(90deg, #fecaca, #fca5a5)", borderRadius: 4, opacity: 0.5 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
            <div style={{ border: "1px solid #eef0f4", borderRadius: 10, padding: 8, textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 6px", background: "conic-gradient(#2563eb 0 120deg, #e2e8f0 120deg)" }} />
              <div style={{ fontSize: 9, fontWeight: 700 }}>Holdings</div>
            </div>
            <div style={{ border: "1px solid #eef0f4", borderRadius: 10, padding: 8, fontSize: 9 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Top Holdings</div>
              {["RELIANCE", "TCS", "HDFCBANK"].map(s => (
                <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f8fafc" }}>
                  <span>{s}</span><span style={{ color: "#16a34a" }}>+1.2%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VirtualLabMock() {
  return (
    <div className="lp-dashboard-mock" style={{ transform: "none" }}>
      <div style={{ padding: 16, background: "#fafafa", borderBottom: "1px solid #eef0f4", display: "flex", gap: 12 }}>
        <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 12, border: "1px solid #eef0f4" }}>
          <div style={{ fontSize: 10, color: "#64748b" }}>Virtual Cash</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>₹10,00,000</div>
        </div>
        <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: 12, border: "1px solid #eef0f4" }}>
          <div style={{ fontSize: 10, color: "#64748b" }}>Today&apos;s P&L</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>+₹1,71,430</div>
        </div>
      </div>
      <div style={{ padding: 12, fontSize: 9 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "#64748b", textAlign: "left" }}>
              <th style={{ padding: 6 }}>Symbol</th><th>Type</th><th>Qty</th><th>P&L</th>
            </tr>
          </thead>
          <tbody>
            {[["BANKNIFTY", "CE", "50", "+12.4%"], ["NIFTY", "PE", "75", "+8.1%"], ["RELIANCE", "EQ", "100", "+2.3%"]].map(r => (
              <tr key={r[0]} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: 6, fontWeight: 700 }}>{r[0]}</td>
                <td>{r[1]}</td><td>{r[2]}</td>
                <td style={{ color: "#16a34a", fontWeight: 700 }}>{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: 12, display: "flex", gap: 8 }}>
        <button type="button" style={{ flex: 1, padding: 10, background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 11 }}>BUY</button>
        <button type="button" style={{ flex: 1, padding: 10, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 11 }}>SELL</button>
      </div>
    </div>
  );
}

export function FeedMock() {
  return (
    <div className="lp-dashboard-mock" style={{ transform: "none" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #eef0f4", fontSize: 11, fontWeight: 700 }}>
        {["For You", "Following", "Trending"].map((t, i) => (
          <div key={t} style={{ flex: 1, padding: "10px 12px", textAlign: "center", borderBottom: i === 0 ? "2px solid #2563eb" : "none", color: i === 0 ? "#2563eb" : "#64748b" }}>{t}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", minHeight: 220 }}>
        <div style={{ padding: 12 }}>
          {[
            { user: "Priya K", text: "NIFTY holding 24,800 support — watching Bank Nifty for momentum.", time: "2h" },
            { user: "Arjun M", text: "Shared my swing setup on RELIANCE. DYOR!", time: "4h" },
          ].map(p => (
            <div key={p.user} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#cbd5e1" }} />
                <strong style={{ fontSize: 11 }}>{p.user}</strong>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{p.time}</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{p.text}</p>
            </div>
          ))}
        </div>
        <aside style={{ borderLeft: "1px solid #eef0f4", padding: 12, fontSize: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Trending Topics</div>
          {["#Nifty", "#BankNifty", "#Options", "#IPO"].map(t => (
            <div key={t} style={{ padding: "6px 0", color: "#2563eb", fontWeight: 600 }}>{t}</div>
          ))}
        </aside>
      </div>
    </div>
  );
}
