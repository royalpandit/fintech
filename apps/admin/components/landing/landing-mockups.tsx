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
  { symbol: "INFY", change: "+0.9%" },
  { symbol: "ICICIBANK", change: "+1.1%" },
  { symbol: "ITC", change: "+0.4%" },
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
              <div className="lp-mock-scrollbox">
                <div className="lp-mock-autoscroll">
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
      </div>
    </div>
  );
}

const PHONE_HOLDINGS = [
  { symbol: "RELIANCE", sub: "12 shares", change: "+1.2%" },
  { symbol: "TCS", sub: "8 shares", change: "+0.8%" },
  { symbol: "HDFCBANK", sub: "20 shares", change: "+1.6%" },
  { symbol: "INFY", sub: "15 shares", change: "+0.9%" },
  { symbol: "ICICIBANK", sub: "10 shares", change: "+1.1%" },
  { symbol: "ITC", sub: "40 shares", change: "+0.4%" },
];

/** Compact mobile-app view, shown beside the desktop dashboard in the hero. */
export function PhoneMock() {
  return (
    <div className="lp-phone" aria-hidden>
      <div className="lp-phone-frame">
        <div className="lp-phone-notch" />
        <div className="lp-phone-screen">
          <div className="lp-phone-head">
            <span className="lp-phone-greet">Portfolio</span>
            <span className="lp-phone-chip up">+18.4%</span>
          </div>
          <div className="lp-phone-value">₹12,45,890</div>
          <div className="lp-phone-sub up">+₹18,420 today</div>

          <div className="lp-phone-spark">
            <svg viewBox="0 0 200 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lpPhoneFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--lp-primary)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--lp-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 46 L28 40 L56 44 L84 28 L112 32 L140 18 L168 22 L200 8"
                fill="none"
                stroke="var(--lp-primary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M0 46 L28 40 L56 44 L84 28 L112 32 L140 18 L168 22 L200 8 L200 60 L0 60 Z"
                fill="url(#lpPhoneFill)"
                stroke="none"
              />
            </svg>
          </div>

          <div className="lp-phone-list">
            <div className="lp-phone-scroll">
              {PHONE_HOLDINGS.map(h => (
                <div key={h.symbol} className="lp-phone-item">
                  <span className="lp-phone-dot" />
                  <div className="lp-phone-item-main">
                    <strong>{h.symbol}</strong>
                    <span>{h.sub}</span>
                  </div>
                  <span className="lp-phone-item-chg up">{h.change}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-phone-tabbar">
            <span className="is-active" />
            <span />
            <span />
            <span />
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
