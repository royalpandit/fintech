"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import FinuerLogo from "@/components/brand/finuer-logo";
import ThemeHeaderButton from "@/components/theme/theme-header-button";
import { BRAND_NAME } from "@/lib/brand";
import { FiTrendingUp, FiArrowUpRight } from "react-icons/fi";

/** Clean white wordmark for the always-emerald brand panel (the PNG logo has a
 *  baked-in dark background that boxes badly on the gradient). */
function AuthWordmark() {
  return (
    <Link href="/" aria-label={BRAND_NAME} className="auth-wordmark">
      <svg className="auth-wordmark-mark" viewBox="0 0 44 40" fill="none" aria-hidden="true">
        <g stroke="#fff" strokeWidth="4" strokeLinecap="round">
          <path d="M10 30 L22 26.2" />
          <path d="M10 22 L28 17" />
          <path d="M10 14 L24 10.5" />
        </g>
        <circle cx="30.5" cy="8.5" r="3.6" fill="#fff" />
      </svg>
      <span className="auth-wordmark-text">{BRAND_NAME}</span>
    </Link>
  );
}

/** One screen's worth of app content — rendered twice inside the phone so the
 *  auto-scroll loops seamlessly. */
function PhoneScreenSet() {
  return (
    <div className="auth-ph-set">
      <div className="auth-ph-card auth-ph-portfolio">
        <div className="auth-ph-label">Portfolio Value</div>
        <div className="auth-ph-value">₹17,366.00</div>
        <div className="auth-ph-chip">
          <FiTrendingUp size={11} /> +2.4% today
        </div>
        <div className="auth-ph-spark">
          {[38, 52, 44, 63, 55, 74, 68, 88, 79, 92].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      <div className="auth-ph-card">
        <div className="auth-ph-card-head">Watchlist</div>
        {[
          ["RELIANCE", "+1.8%", true],
          ["TCS", "+0.9%", true],
          ["HDFC BANK", "-0.4%", false],
          ["INFY", "+1.1%", true],
        ].map(([sym, chg, up]) => (
          <div key={sym as string} className="auth-ph-row">
            <span className="auth-ph-tkr">{sym}</span>
            <span className={up ? "auth-ph-up" : "auth-ph-down"}>{chg}</span>
          </div>
        ))}
      </div>

      <div className="auth-ph-card auth-ph-post">
        <div className="auth-ph-post-head">
          <span className="auth-ph-avatar">PK</span>
          <div>
            <div className="auth-ph-post-name">Priya K · SEBI RA</div>
            <div className="auth-ph-post-time">2h ago</div>
          </div>
        </div>
        <p className="auth-ph-post-text">
          NIFTY holding 24,800 support — watching Bank Nifty for momentum. 📈
        </p>
      </div>

      <div className="auth-ph-card auth-ph-agent">
        <span className="auth-ph-agent-avatar">🤖</span>
        <div>
          <div className="auth-ph-agent-name">Finn · AI Assistant</div>
          <div className="auth-ph-agent-msg">
            “What’s an index fund?” <FiArrowUpRight size={11} />
          </div>
        </div>
      </div>

      <div className="auth-ph-card">
        <div className="auth-ph-card-head">Markets</div>
        {[
          ["NIFTY 50", "24,850", "+0.6%", true],
          ["SENSEX", "81,340", "+0.5%", true],
          ["BANK NIFTY", "51,120", "-0.2%", false],
        ].map(([sym, px, chg, up]) => (
          <div key={sym as string} className="auth-ph-row">
            <span className="auth-ph-tkr">{sym}</span>
            <span className="auth-ph-idx">
              {px} <span className={up ? "auth-ph-up" : "auth-ph-down"}>{chg}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthSplitLayout({
  children,
  variant,
  wide = false,
}: {
  children: ReactNode;
  variant: "sign-in" | "sign-up";
  wide?: boolean;
}) {
  const headline =
    variant === "sign-in"
      ? "A smarter home for your investing."
      : "Start your investing journey with confidence.";
  const sub =
    variant === "sign-in"
      ? "Live markets, virtual trading, expert stock baskets and AI agents — all in one place."
      : "Join a community of investors and finance professionals learning, tracking and growing together.";

  return (
    <div className="auth-stage">
      <main className="auth-split">
      {/* ── Brand / visual panel (hidden on mobile) ── */}
      <aside className="auth-brand-panel">
          <div className="auth-brand-top">
            <AuthWordmark />
          </div>

          {/* Auto-scrolling phone demo of the app */}
          <div className="auth-brand-visual" aria-hidden="true">
            <div className="auth-phone">
              <div className="auth-phone-frame">
                <div className="auth-phone-notch" />
                <div className="auth-phone-screen">
                  <div className="auth-phone-track">
                    <PhoneScreenSet />
                    <PhoneScreenSet />
                  </div>
                  <div className="auth-phone-fade" />
                </div>
              </div>
            </div>
          </div>

          <div className="auth-brand-content">
            <h2 className="auth-brand-headline">{headline}</h2>
            <p className="auth-brand-sub">{sub}</p>
          </div>

          <div className="auth-brand-footer">
            © {new Date().getFullYear()} {BRAND_NAME} · Educational use only ·
            Investing involves risk.
          </div>
        </aside>

        {/* ── Right: form panel ── */}
        <section className="auth-form-panel">
          <div className="auth-form-topbar">
            <ThemeHeaderButton />
          </div>

          <div className="auth-form-scroll">
            <div className={`auth-form-inner${wide ? " auth-form-wide" : ""}`}>
              {/* Logo shown only on mobile, where the brand panel is hidden */}
              <div className="auth-form-mobile-logo">
                <FinuerLogo href="/" height={38} />
              </div>

              {/* Sign in / Sign up segmented tabs */}
              <div className="auth-tabs" role="tablist" aria-label="Authentication">
                <Link
                  href="/login"
                  className={`auth-tab${variant === "sign-in" ? " auth-tab-active" : ""}`}
                  role="tab"
                  aria-selected={variant === "sign-in"}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className={`auth-tab${variant === "sign-up" ? " auth-tab-active" : ""}`}
                  role="tab"
                  aria-selected={variant === "sign-up"}
                >
                  Sign Up
                </Link>
              </div>

              {children}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
