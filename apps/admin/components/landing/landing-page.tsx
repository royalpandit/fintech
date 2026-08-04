import Link from "next/link";
import LandingHeader from "./landing-header";
import LandingTicker from "./landing-ticker";
import FinuerLogo from "@/components/brand/finuer-logo";
import Reveal from "@/components/motion/reveal";
import Counter from "@/components/motion/counter";
import LandingBackground from "./landing-background";
import LandingPopup from "./landing-popup";
import AdvisorCarousel from "./advisor-carousel";
import ProductSlider from "./product-slider";
import { DashboardMock, FeedMock, PhoneMock, VirtualLabMock } from "./landing-mockups";
import type { LandingAdvisor } from "./types";

export type { LandingAdvisor };

/** `tone` maps to a token-driven icon style so the tiles survive dark mode. */
const FEATURES = [
  {
    icon: "📱",
    tone: "emerald",
    title: "Social FinMedia Feed",
    desc: "Follow markets, share insights, and learn from a community of investors and advisors.",
    href: "/user/feed",
    link: "Explore Feed",
  },
  {
    icon: "✓",
    tone: "teal",
    title: "SEBI Registered Advisors",
    desc: "Connect with verified professionals for research-backed guidance you can trust.",
    href: "/user/advisors",
    link: "Find Advisors",
  },
  {
    icon: "🧪",
    tone: "violet",
    title: "Virtual Lab",
    desc: "Practice trading with real-time simulated markets and unlimited virtual cash.",
    href: "/user/lab",
    link: "Try Virtual Lab",
    badge: true,
  },
  {
    icon: "📊",
    tone: "amber",
    title: "Smart Portfolio Tracking",
    desc: "Track holdings, P&L, and performance with beautiful charts and daily snapshots.",
    href: "/register",
    link: "Track Portfolio",
  },
  {
    icon: "📈",
    tone: "sky",
    title: "Markets & Insights",
    desc: "Live indices, option chains, and professional-grade charts in one terminal.",
    href: "/user/markets",
    link: "View Markets",
  },
  {
    icon: "🎓",
    tone: "rose",
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

const TRUST = [
  "SEBI Registered Advisors",
  "Bank-Grade Security",
  "10L+ Users And Growing",
  "Made in India For the World",
];

const LAB_POINTS = [
  "Real-time simulated market",
  "Unlimited virtual cash",
  "Full order book experience",
  "Track P&L like a pro",
];

type Props = {
  advisors?: LandingAdvisor[];
};

export default function LandingPage({ advisors = FALLBACK_ADVISORS }: Props) {
  return (
    <div className="landing-root">
      <LandingBackground />
      <LandingHeader />

      <section className="lp-hero">
        <div className="landing-container lp-hero-grid">
          <Reveal variant="left" className="lp-hero-copy">
            <div className="lp-pill">
              <span className="lp-pill-dot" aria-hidden />
              All-in-One FinMedia Platform
            </div>
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
                <span aria-hidden>▷</span> Explore Platform
              </Link>
            </div>
            <div className="lp-trust-row">
              {TRUST.map((t, i) => (
                <Reveal key={t} className="lp-trust-item" variant="fade" delay={120 + i * 70}>
                  <span className="lp-trust-icon" aria-hidden>✓</span>
                  {t}
                </Reveal>
              ))}
            </div>
            <div className="lp-social-proof">
              <div className="lp-avatars">
                {["AK", "PS", "RM", "DV"].map(i => (
                  <span key={i}>{i}</span>
                ))}
                <span className="lp-avatars-more">+2K</span>
              </div>
              <div className="lp-stars">
                <Counter to={4.9} decimals={1} suffix="/5 stars" />
                <small>
                  Trusted by <Counter to={2000} locale="en-IN" suffix="+" /> investors
                </small>
              </div>
            </div>
          </Reveal>

          <Reveal variant="right" delay={140} className="lp-hero-visual">
            <div className="lp-device-combo">
              <div className="lp-device-desktop">
                <DashboardMock />
              </div>
              <div className="lp-device-phone">
                <PhoneMock />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div id="markets">
        <LandingTicker />
      </div>

      <section className="lp-section" id="products">
        <div className="landing-container">
          <Reveal className="lp-section-head">
            <div className="lp-kicker">Powerful Products</div>
            <h2>Everything you need to invest and grow</h2>
            <p>
              From social feeds to virtual trading and verified advisors — Finuer gives you the
              complete toolkit for your investment journey.
            </p>
          </Reveal>
          <div className="lp-features-grid">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                as="article"
                className="lp-feature-card lift"
                variant="pop"
                delay={i * 80}
              >
                <div className={`lp-feature-icon lp-feature-icon--${f.tone}`} aria-hidden>
                  {f.icon}
                </div>
                <h3>
                  {f.title}
                  {f.badge && <span className="lp-badge-new">New</span>}
                </h3>
                <p>{f.desc}</p>
                <Link href={f.href} className="lp-feature-link">
                  {f.link} <span aria-hidden>→</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--band" id="product-tour">
        <div className="landing-container">
          <Reveal className="lp-section-head">
            <div className="lp-kicker">Product Tour</div>
            <h2>See the platform in action</h2>
            <p>
              Flip through the screens you&apos;ll actually use — portfolio tracking, the virtual
              trading lab, and the social feed.
            </p>
          </Reveal>
          <Reveal variant="fade" delay={100}>
            <ProductSlider />
          </Reveal>
        </div>
      </section>

      <section className="lp-section" id="virtual-lab">
        <div className="landing-container">
          <Reveal className="lp-split surface" variant="scale">
            <div>
              <div className="lp-kicker">Practice. Learn. Master.</div>
              <h2 className="lp-split-title">Virtual Lab</h2>
              <p className="lp-split-lead">
                Trade with real-time simulated markets using unlimited virtual cash. Perfect your
                strategies before risking real capital.
              </p>
              <ul className="lp-checklist">
                {LAB_POINTS.map(t => (
                  <li key={t}>
                    <span className="lp-check" aria-hidden>✓</span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/user/lab" className="lp-btn-primary">
                Explore Virtual Lab <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="lp-mock-scroll lp-mock-float">
              <VirtualLabMock />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-section--band" id="advisors">
        <div className="landing-container">
          <div className="lp-advisors-head">
            <Reveal className="lp-section-head">
              <div className="lp-kicker">SEBI Registered</div>
              <h2>Trusted advice from verified professionals</h2>
              <p>
                Every advisor on Finuer is SEBI registered. Follow their research, insights, and
                trade ideas with full transparency.
              </p>
            </Reveal>
            <Reveal variant="fade" delay={120}>
              <Link href="/user/advisors" className="lp-btn-outline">
                View All Advisors <span aria-hidden>→</span>
              </Link>
            </Reveal>
          </div>
          <Reveal variant="fade">
            <AdvisorCarousel advisors={advisors} />
          </Reveal>
        </div>
      </section>

      <section className="lp-section" id="community">
        <div className="landing-container lp-split">
          <Reveal variant="left">
            <div className="lp-kicker">A Community That Grows Together</div>
            <h2 className="lp-split-title">Learn, share and grow with investors like you</h2>
            <p className="lp-split-lead">
              Join discussions, follow trending topics, and build your network on India&apos;s
              fastest-growing investing community.
            </p>
            <div className="lp-community-stats">
              <div className="lp-stat">
                <strong><Counter to={10} suffix="L+" /></strong>
                <span>Members</span>
              </div>
              <div className="lp-stat">
                <strong><Counter to={25} suffix="K+" /></strong>
                <span>Daily Discussions</span>
              </div>
              <div className="lp-stat">
                <strong><Counter to={2} suffix="K+" /></strong>
                <span>Posts/Day</span>
              </div>
            </div>
            <Link href="/register" className="lp-btn-primary">
              Join Community <span aria-hidden>→</span>
            </Link>
          </Reveal>
          <Reveal variant="right" delay={120} className="lp-mock-scroll lp-mock-float">
            <FeedMock />
          </Reveal>
        </div>
      </section>

      <section className="lp-cta" id="pricing">
        <div className="landing-container">
          <Reveal className="lp-cta-inner" variant="scale">
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
          </Reveal>
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
              <div className="lp-sebi-box">
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

      <LandingPopup />
    </div>
  );
}
