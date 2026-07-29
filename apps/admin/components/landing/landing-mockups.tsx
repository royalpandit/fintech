/**
 * Static UI mockups for the landing page.
 *
 * Styling lives in landing.css rather than inline so these follow the theme
 * tokens — the previous inline hexes were light-mode only and inverted badly
 * against the dark palette.
 */

const RAIL_ICONS = ["▦", "◇", "◎", "◉", "☰"];

const TOP_HOLDINGS = [
  { symbol: "RELIANCE", change: "+1.2%" },
  { symbol: "TCS", change: "+0.8%" },
  { symbol: "HDFCBANK", change: "+1.6%" },
];

export function DashboardMock() {
  return (
    <div className="lp-dashboard-mock lp-mock--tilt">
      <div className="lp-mock-chrome" aria-hidden>
        <span /><span /><span />
      </div>
      <div className="lp-mock-shell">
        <aside className="lp-mock-rail" aria-hidden>
          {RAIL_ICONS.map((ic, i) => (
            <div key={ic} className={`lp-mock-rail-icon${i === 0 ? " is-active" : ""}`}>
              {ic}
            </div>
          ))}
        </aside>

        <div className="lp-mock-body">
          <div className="lp-mock-greet">Good morning,</div>
          <div className="lp-mock-user">Rohan 👋</div>

          <div className="lp-mock-stats">
            <div className="lp-mock-tile">
              <div className="lp-mock-tile-label">Total Portfolio</div>
              <div className="lp-mock-tile-value">₹12,45,890</div>
              <div className="lp-mock-tile-delta up">+2.4%</div>
              <div className="lp-mock-bar lp-mock-bar--up" />
            </div>
            <div className="lp-mock-tile">
              <div className="lp-mock-tile-label">Today&apos;s P&amp;L</div>
              <div className="lp-mock-tile-value up">+₹18,420</div>
              <div className="lp-mock-tile-delta">Realised + unrealised</div>
              <div className="lp-mock-bar lp-mock-bar--soft" />
            </div>
          </div>

          <div className="lp-mock-split">
            <div className="lp-mock-tile lp-mock-tile--center">
              <div className="lp-mock-donut" />
              <div className="lp-mock-tile-caption">Holdings</div>
            </div>
            <div className="lp-mock-tile">
              <div className="lp-mock-tile-caption">Top Holdings</div>
              {TOP_HOLDINGS.map(h => (
                <div key={h.symbol} className="lp-mock-row">
                  <span>{h.symbol}</span>
                  <span className="up">{h.change}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const LAB_POSITIONS = [
  { symbol: "BANKNIFTY", type: "CE", qty: "50", pnl: "+12.4%" },
  { symbol: "NIFTY", type: "PE", qty: "75", pnl: "+8.1%" },
  { symbol: "RELIANCE", type: "EQ", qty: "100", pnl: "+2.3%" },
];

export function VirtualLabMock() {
  return (
    <div className="lp-dashboard-mock">
      <div className="lp-mock-chrome" aria-hidden>
        <span /><span /><span />
      </div>

      <div className="lp-mock-labhead">
        <div className="lp-mock-tile">
          <div className="lp-mock-tile-label">Virtual Cash</div>
          <div className="lp-mock-tile-value">₹10,00,000</div>
        </div>
        <div className="lp-mock-tile">
          <div className="lp-mock-tile-label">Today&apos;s P&amp;L</div>
          <div className="lp-mock-tile-value up">+₹1,71,430</div>
        </div>
      </div>

      <div className="lp-mock-tablewrap">
        <table className="lp-mock-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Qty</th>
              <th>P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {LAB_POSITIONS.map(r => (
              <tr key={r.symbol}>
                <td className="sym">{r.symbol}</td>
                <td>{r.type}</td>
                <td>{r.qty}</td>
                <td className="up">{r.pnl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lp-mock-actions">
        <span className="lp-mock-btn lp-mock-btn--buy">BUY</span>
        <span className="lp-mock-btn lp-mock-btn--sell">SELL</span>
      </div>
    </div>
  );
}

const FEED_POSTS = [
  { user: "Priya K", text: "NIFTY holding 24,800 support — watching Bank Nifty for momentum.", time: "2h" },
  { user: "Arjun M", text: "Shared my swing setup on RELIANCE. DYOR!", time: "4h" },
];

const TRENDING = ["#Nifty", "#BankNifty", "#Options", "#IPO"];

export function FeedMock() {
  return (
    <div className="lp-dashboard-mock">
      <div className="lp-mock-chrome" aria-hidden>
        <span /><span /><span />
      </div>

      <div className="lp-mock-tabs">
        {["For You", "Following", "Trending"].map((t, i) => (
          <div key={t} className={`lp-mock-tab${i === 0 ? " is-active" : ""}`}>{t}</div>
        ))}
      </div>

      <div className="lp-mock-feed">
        <div className="lp-mock-posts">
          {FEED_POSTS.map(p => (
            <div key={p.user} className="lp-mock-post">
              <div className="lp-mock-post-head">
                <div className="lp-mock-avatar" aria-hidden />
                <strong>{p.user}</strong>
                <span className="lp-mock-time">{p.time}</span>
              </div>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
        <aside className="lp-mock-trending">
          <div className="lp-mock-tile-caption">Trending Topics</div>
          {TRENDING.map(t => (
            <div key={t} className="lp-mock-tag">{t}</div>
          ))}
        </aside>
      </div>
    </div>
  );
}
