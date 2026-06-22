import Link from "next/link";
import LandingHeader from "./landing-header";
import LandingTicker from "./landing-ticker";
import FinuerLogo from "@/components/brand/finuer-logo";
import { DashboardMock, FeedMock, VirtualLabMock } from "./landing-mockups";
export type LandingAdvisor = {
  id: number;
  name: string;
  sebi: string;
  expertise: string;
  years: number;
  returnsPct: number;
  initials: string;
};

const FEATURES = [
  {
    icon: "📱",
    bg: "#dcfce7",
    title: "Social FinMedia Feed",
    desc: "Follow markets, share insights, and learn from a community of investors and advisors.",
    href: "/user/feed",
    link: "Explore Feed",
  },
  {
    icon: "✓",
    bg: "#dbeafe",
    title: "SEBI Registered Advisors",
    desc: "Connect with verified professionals for research-backed guidance you can trust.",
    href: "/user/advisors",
    link: "Find Advisors",
  },
  {
    icon: "🧪",
    bg: "#ede9fe",
    title: "Virtual Lab",
    desc: "Practice trading with real-time simulated markets and unlimited virtual cash.",
    href: "/user/lab",
    link: "Try Virtual Lab",
    badge: true,
  },
  {
    icon: "📊",
    bg: "#ffedd5",
    title: "Smart Portfolio Tracking",
    desc: "Track holdings, P&L, and performance with beautiful charts and daily snapshots.",
    href: "/register",
    link: "Track Portfolio",
  },
  {
    icon: "📈",
    bg: "#e0f2fe",
    title: "Markets & Insights",
    desc: "Live indices, option chains, and professional-grade charts in one terminal.",
    href: "/user/markets",
    link: "View Markets",
  },
  {
    icon: "🎓",
    bg: "#fce7f3",
    title: "Courses & Learning",
    desc: "Structured courses from top advisors to build your investing knowledge.",
    href: "/user/courses",
    link: "Browse Courses",
  },
];

const FALLBACK_ADVISORS: LandingAdvisor[] = [
  { id: 1, name: "Ankit Shah", sebi: "INH000012345", expertise: "Equity + Derivatives", years: 12, returnsPct: 18.4, initials: "AS" },
  { id: 2, name: "Priya Mehta", sebi: "INH000023456", expertise: "Options Specialist", years: 9, returnsPct: 22.1, initials: "PM" },
  { id: 3, name: "Rahul Verma", sebi: "INH000034567", expertise: "Mid & Small Cap", years: 15, returnsPct: 16.8, initials: "RV" },
  { id: 4, name: "Sneha Rao", sebi: "INH000045678", expertise: "Banking & FMCG", years: 7, returnsPct: 19.5, initials: "SR" },
];

type Props = {
  advisors?: LandingAdvisor[];
};

export default function LandingPage({ advisors = FALLBACK_ADVISORS }: Props) {
  return (
    <div className="landing-root">
      <LandingHeader />

      <section className="lp-hero">
        <div className="landing-container lp-hero-grid">
          <div>
            <div className="lp-pill">All-in-One FinMedia Platform</div>
            <h1>
              Learn. Invest. Connect. <span className="lp-gradient-text">Grow.</span>
            </h1>
            <p className="lp-hero-lead">
              Finuer brings together social investing, expert insights, virtual trading, and a
              community of SEBI registered advisors — all in one place.
            </p>
            <div className="lp-hero-ctas">
              <Link href="/register" className="lp-btn-primary">
                Get Started for Free <span aria-hidden>→</span>
              </Link>
              <Link href="/user/feed" className="lp-btn-outline">
                ▷ Explore Platform
              </Link>
            </div>
            <div className="lp-trust-row">
              {[
                "SEBI Registered Advisors",
                "Bank-Grade Security",
                "10L+ Users And Growing",
                "Made in India For the World",
              ].map(t => (
                <div key={t} className="lp-trust-item">
                  <span className="lp-trust-icon">✓</span>
                  {t}
                </div>
              ))}
            </div>
            <div className="lp-social-proof">
              <div className="lp-avatars">
                {["AK", "PS", "RM", "DV"].map(i => (
                  <span key={i}>{i}</span>
                ))}
                <span style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>+2K</span>
              </div>
              <div className="lp-stars">
                4.9/5 stars
                <small>Trusted by 2,000+ investors</small>
              </div>
            </div>
          </div>
          <div className="lp-hero-visual lp-mock-scroll">
            <DashboardMock />
          </div>
        </div>
      </section>

      <div id="markets">
        <LandingTicker />
      </div>

      <section className="lp-section" id="products">
        <div className="landing-container">
          <div className="lp-section-head">
            <div className="lp-kicker">Powerful Products</div>
            <h2>Everything you need to invest and grow</h2>
            <p>
              From social feeds to virtual trading and verified advisors — Finuer gives you the
              complete toolkit for your investment journey.
            </p>
          </div>
          <div className="lp-features-grid">
            {FEATURES.map(f => (
              <article key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon" style={{ background: f.bg }}>{f.icon}</div>
                <h3>
                  {f.title}
                  {f.badge && <span className="lp-badge-new">New</span>}
                </h3>
                <p>{f.desc}</p>
                <Link href={f.href} className="lp-feature-link">{f.link} →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="virtual-lab" style={{ paddingTop: 0 }}>
        <div className="landing-container">
          <div className="lp-split surface">
            <div>
              <div className="lp-kicker">Practice. Learn. Master.</div>
              <h2 style={{ fontSize: "2rem", fontWeight: 600, margin: "0 0 12px" }}>Virtual Lab</h2>
              <p style={{ color: "var(--lp-muted)", lineHeight: 1.65, margin: 0 }}>
                Trade with real-time simulated markets using unlimited virtual cash. Perfect your
                strategies before risking real capital.
              </p>
              <ul className="lp-checklist">
                {[
                  "Real-time simulated market",
                  "Unlimited virtual cash",
                  "Full order book experience",
                  "Track P&L like a pro",
                ].map(t => (
                  <li key={t}><span className="lp-check">✓</span>{t}</li>
                ))}
              </ul>
              <Link href="/user/lab" className="lp-btn-primary">
                Explore Virtual Lab <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="lp-mock-scroll">
              <VirtualLabMock />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section" id="advisors">
        <div className="landing-container">
          <div className="lp-advisors-head">
            <div className="lp-section-head">
              <div className="lp-kicker">SEBI Registered</div>
              <h2>Trusted advice from verified professionals</h2>
              <p>
                Every advisor on Finuer is SEBI registered. Follow their research, insights, and
                trade ideas with full transparency.
              </p>
            </div>
            <Link href="/user/advisors" className="lp-btn-outline">
              View All Advisors →
            </Link>
          </div>
          <div className="lp-advisor-grid">
            {advisors.map(a => (
              <article key={a.id} className="lp-advisor-card">
                <div className="lp-advisor-photo">{a.initials}</div>
                <div className="lp-advisor-body">
                  <h3>{a.name}</h3>
                  <div className="lp-advisor-meta">SEBI Reg. {a.sebi}</div>
                  <div className="lp-advisor-tags">{a.expertise} · {a.years} yrs exp.</div>
                  <div className="lp-advisor-return">
                    +{a.returnsPct.toFixed(1)}%
                    <small>Avg. Returns</small>
                  </div>
                  <Link href="/register" className="lp-btn-follow">Follow</Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="community" style={{ background: "var(--lp-bg)" }}>
        <div className="landing-container lp-split">
          <div>
            <div className="lp-kicker">A Community That Grows Together</div>
            <h2 style={{ fontSize: "2rem", fontWeight: 600, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
              Learn, share and grow with investors like you
            </h2>
            <p style={{ color: "var(--lp-muted)", lineHeight: 1.65, margin: 0 }}>
              Join discussions, follow trending topics, and build your network on India&apos;s
              fastest-growing investing community.
            </p>
            <div className="lp-community-stats">
              <div className="lp-stat"><strong>10L+</strong><span>Members</span></div>
              <div className="lp-stat"><strong>25K+</strong><span>Daily Discussions</span></div>
              <div className="lp-stat"><strong>2K+</strong><span>Posts/Day</span></div>
            </div>
            <Link href="/register" className="lp-btn-primary">
              Join Community <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="lp-mock-scroll">
            <FeedMock />
          </div>
        </div>
      </section>

      <section className="lp-cta" id="pricing">
        <div className="landing-container">
          <div className="lp-cta-inner">
            <h2>Start your investment journey today</h2>
            <p>Learn, invest, connect and grow with Finuer.</p>
            <div className="lp-cta-btns">
              <Link href="/register" className="lp-btn-primary lp-btn-white">
                Get Started for Free <span aria-hidden>→</span>
              </Link>
              <Link href="/user/feed" className="lp-btn-primary lp-btn-ghost">
                Explore Platform
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer" id="company">
        <div className="landing-container">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <FinuerLogo href="/" height={40} className="lp-brand-logo" />
              <p>India&apos;s all-in-one platform for learning, investing, and connecting with verified advisors.</p>
              <div className="lp-social">
                <a href="#" aria-label="X">X</a>
                <a href="#" aria-label="Instagram">IG</a>
                <a href="#" aria-label="YouTube">YT</a>
                <a href="#" aria-label="LinkedIn">in</a>
              </div>
            </div>
            <div className="lp-footer-col" id="resources">
              <h4>Products</h4>
              <Link href="/user/feed">FinMedia Feed</Link>
              <Link href="/user/advisors">Advisors</Link>
              <Link href="/user/lab">Virtual Lab</Link>
              <Link href="/user/markets">Markets</Link>
            </div>
            <div className="lp-footer-col">
              <h4>Resources</h4>
              <Link href="/user/courses">Courses</Link>
              <Link href="/user/community">Community</Link>
              <Link href="#">Blog</Link>
              <Link href="#">Help Center</Link>
            </div>
            <div className="lp-footer-col">
              <h4>Company</h4>
              <Link href="#">About Us</Link>
              <Link href="#">Careers</Link>
              <Link href="#">Contact</Link>
              <Link href="#">Press</Link>
            </div>
            <div className="lp-footer-col">
              <h4>Legal</h4>
              <Link href="#">Privacy Policy</Link>
              <Link href="#">Terms of Use</Link>
              <Link href="#">Disclaimer</Link>
              <div className="lp-sebi-box" style={{ marginTop: 16 }}>
                <strong>SEBI Registered Platform</strong>
                Investment in securities market are subject to market risks. Read all related documents carefully.
              </div>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© {new Date().getFullYear()} Finuer. All rights reserved.</span>
            <span>Made with ❤️ in India</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
