"use client";

import Link from "next/link";
import FinuerLogo from "@/components/brand/finuer-logo";
import { BRAND_NAME } from "@/lib/brand";
import ThemeToggleMenu from "@/components/theme/theme-toggle-menu";
import ThemeHeaderButton from "@/components/theme/theme-header-button";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useRef } from "react";
import type { ComponentType } from "react";
import {
  FiHome,
  FiUsers,
  FiTrendingUp,
  FiMessageCircle,
  FiBell,
  FiSettings,
  FiPieChart,
  FiStar,
  FiBriefcase,
  FiClock,
  FiBookOpen,
  FiTarget,
  FiMessageSquare,
  FiMenu,
  FiCreditCard,
  FiX,
  FiSearch,
  FiChevronRight,
} from "react-icons/fi";
import { TbFlask } from "react-icons/tb";
import WatchlistStoreProvider from "@/components/watchlist/watchlist-store-provider";

type UserShellProps = {
  children: React.ReactNode;
  currentUser: { fullName: string; email: string; isVerified: boolean } | null;
  unreadNotifications: number;
  walletBalance: number;
  todayPnL: number;
  todayPnLPct: number;
};

type NavItem = {
  label: string;
  href: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  badge?: string;
};

const MAIN_NAV: NavItem[] = [
  { label: "Feed",          href: "/user/feed",          Icon: FiHome },
  { label: "Advisors",      href: "/user/advisors",      Icon: FiUsers },
  { label: "Markets",       href: "/user/markets",       Icon: FiTrendingUp },
  { label: "Messages",      href: "/user/messages",      Icon: FiMessageCircle },
  { label: "Community",     href: "/user/community",     Icon: FiMessageSquare },
  { label: "Notifications", href: "/user/notifications", Icon: FiBell },
  { label: "Settings",      href: "/user/settings",      Icon: FiSettings },
];

const INVESTING_NAV: NavItem[] = [
  { label: "Dashboard",    href: "/user/home",      Icon: FiPieChart },
  { label: "AI Stock Picks", href: "/user/stock-picks", Icon: FiTarget },
  { label: "Wallet",       href: "/user/wallet",    Icon: FiCreditCard },
  { label: "Watchlist",    href: "/user/watchlist", Icon: FiStar },
  { label: "Portfolio",    href: "/user/portfolio", Icon: FiBriefcase },
  { label: "Courses",      href: "/user/courses",   Icon: FiBookOpen },
  { label: "Virtual Lab",  href: "/user/lab",       Icon: TbFlask, badge: "Paper" },
  { label: "Trade History",href: "/user/history",   Icon: FiClock },
];

const BOTTOM_NAV: NavItem[] = [
  { label: "Feed",      href: "/user/feed",          Icon: FiHome },
  { label: "Advisors",  href: "/user/advisors",      Icon: FiUsers },
  { label: "Markets",   href: "/user/markets",       Icon: FiTrendingUp },
  { label: "Messages",  href: "/user/messages",      Icon: FiMessageCircle },
  { label: "Alerts",    href: "/user/notifications", Icon: FiBell },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatINRCompact(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

export default function UserShell({
  children,
  currentUser,
  unreadNotifications,
  walletBalance,
  todayPnL,
  todayPnLPct,
}: UserShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [search, setSearch] = useState("");

  function submitSearch() {
    const q = search.trim();
    if (!q) return;
    router.push(`/user/search?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  }
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = currentUser ? getInitials(currentUser.fullName) : "G";
  const pnlColor = todayPnL >= 0 ? "#16a34a" : "#dc2626";
  const pnlSign = todayPnL >= 0 ? "+" : "";

  const isVerified = Boolean(currentUser?.isVerified);

  const mainNav = useMemo(() => {
    // Default: only Feed visible until verified
    if (!currentUser) return MAIN_NAV.filter((i) => i.href === "/user/feed");
    if (!isVerified) return MAIN_NAV.filter((i) => i.href === "/user/feed");
    return MAIN_NAV;
  }, [currentUser, isVerified]);

  const investingNav = useMemo(() => {
    if (!currentUser || !isVerified) return [];
    return INVESTING_NAV;
  }, [currentUser, isVerified]);

  const bottomNav = useMemo(() => {
    if (!currentUser || !isVerified) return BOTTOM_NAV.filter((i) => i.href === "/user/feed");
    return BOTTOM_NAV;
  }, [currentUser, isVerified]);

  // Hard guard: if logged-in but not verified, keep to Feed
  useEffect(() => {
    if (!currentUser) return;
    if (isVerified) return;
    if (pathname.startsWith("/user") && pathname !== "/user/feed" && !pathname.startsWith("/user/feed/")) {
      router.replace("/user/feed");
    }
  }, [currentUser, isVerified, pathname, router]);

  // Close menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Restore desktop collapsed preference
  useEffect(() => {
    try {
      if (localStorage.getItem("us-sidebar-collapsed") === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      document.body.style.overflow = mq.matches && mobileDrawerOpen ? "hidden" : "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.body.style.overflow = "";
    };
  }, [mobileDrawerOpen]);

  // Escape closes mobile drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleSidebar = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setMobileDrawerOpen((v) => !v);
      return;
    }
    setSidebarCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("us-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      router.push("/user/home");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div
      className={`us-root advisor-scope${sidebarCollapsed ? " us-sidebar-collapsed" : " us-sidebar-expanded"}`}
    >
      {/* ── Header ── */}
      <header className="us-header">
        <div className="us-header-inner">

          {/* Left zone — logo + hamburger */}
          <div className="us-header-left">
            <button
              className="us-hamburger"
              type="button"
              aria-label={mobileDrawerOpen ? "Close navigation menu" : "Toggle navigation menu"}
              aria-expanded={isMobile ? mobileDrawerOpen : !sidebarCollapsed}
              onClick={toggleSidebar}
            >
              {mobileDrawerOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>

            <FinuerLogo href="/user/home" height={36} className="us-brand-logo" />
          </div>

          {/* Center zone — search */}
          <div className={`us-search-wrap ${searchOpen ? "us-search-open" : ""}`}>
            <form
              className="us-search-inner"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <FiSearch size={14} className="us-search-icon" />
              <input
                className="us-search-input"
                placeholder="Search advisors, symbols, courses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          </div>

          {/* Right zone — actions */}
          <div className="us-header-right">
            {/* Mobile search toggle */}
            <button
              className="us-icon-btn us-search-toggle"
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <FiSearch size={18} />
            </button>

            <ThemeHeaderButton />

            {currentUser ? (
              <>
                <Link
                  href="/user/messages"
                  className="us-icon-btn"
                  aria-label="Messages"
                >
                  <FiMessageCircle size={18} />
                </Link>

                <Link
                  href="/user/notifications"
                  className="us-icon-btn"
                  aria-label="Notifications"
                  style={{ position: "relative" }}
                >
                  <FiBell size={18} />
                  {unreadNotifications > 0 && (
                    <span className="us-notif-dot" />
                  )}
                </Link>

                <div className="us-avatar-wrap" ref={menuRef}>
                  <button
                    type="button"
                    className="us-avatar-btn"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Account menu"
                    title={currentUser.fullName}
                  >
                    {initials}
                  </button>

                  {menuOpen && (
                    <div className="us-dropdown">
                      <div className="us-dropdown-head">
                        <div className="us-dropdown-avatar">{initials}</div>
                        <div>
                          <div className="us-dropdown-name">{currentUser.fullName}</div>
                          <div className="us-dropdown-email">{currentUser.email}</div>
                        </div>
                      </div>
                      <div className="us-dropdown-divider" />
                      {[
                        { label: "Profile", href: "/user/profile" },
                        { label: "Portfolio", href: "/user/portfolio" },
                        { label: "Watchlist", href: "/user/watchlist" },
                        { label: "Settings", href: "/user/settings" },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="us-dropdown-link"
                          onClick={() => setMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                      <div className="us-dropdown-divider" />
                      <ThemeToggleMenu onSelect={() => setMenuOpen(false)} />
                      <div className="us-dropdown-divider" />
                      <button
                        type="button"
                        className="us-dropdown-logout"
                        onClick={handleLogout}
                        disabled={loggingOut}
                      >
                        {loggingOut ? "Signing out…" : "Sign out"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="us-header-signin">Sign in</Link>
                <Link href="/register" className="us-header-cta">Get started</Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile search bar (expands below header) */}
        {searchOpen && (
          <div className="us-mobile-search">
            <form
              className="us-search-inner"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch();
              }}
            >
              <FiSearch size={14} className="us-search-icon" />
              <input
                className="us-search-input"
                placeholder="Search advisors, symbols, courses…"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="us-body">

        {/* Overlay backdrop (mobile) */}
        {mobileDrawerOpen && (
          <div
            className="us-overlay"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Left Sidebar ── */}
        <aside
          className={`us-sidebar${mobileDrawerOpen ? " us-sidebar-open" : ""}`}
          aria-label="Main navigation"
        >
          <div className="us-sidebar-inner">
            <button
              type="button"
              className="us-sidebar-drawer-close"
              aria-label="Close menu"
              onClick={() => setMobileDrawerOpen(false)}
            >
              <FiX size={18} />
            </button>

            {/* Profile card */}
            <div className="us-profile-card">
              <div className="us-profile-row">
                <div
                  className="us-profile-avatar"
                  style={{
                    background: currentUser
                      ? "linear-gradient(135deg,#0ea5e9,#10b981)"
                      : "linear-gradient(135deg,#94a3b8,#64748b)",
                  }}
                >
                  {initials}
                </div>
                <div className="us-profile-info">
                  <div className="us-profile-name">
                    {currentUser?.fullName ?? "Guest Visitor"}
                  </div>
                  <div className="us-profile-role">
                    {currentUser ? "Investor" : "Sign in to personalise"}
                  </div>
                </div>
              </div>

              {currentUser ? (
                <div className="us-profile-stats">
                  <div className="us-profile-stat">
                    <span className="us-profile-stat-label">Virtual Balance</span>
                    <span className="us-profile-stat-val">{formatINR(walletBalance)}</span>
                  </div>
                  <div className="us-profile-stat">
                    <span className="us-profile-stat-label">Today&rsquo;s P&amp;L</span>
                    <span className="us-profile-stat-val" style={{ color: pnlColor }}>
                      {pnlSign}{formatINRCompact(Math.abs(todayPnL))}
                      <span style={{ fontSize: 10, marginLeft: 3 }}>
                        ({pnlSign}{todayPnLPct.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                </div>
              ) : (
                <Link href="/register" className="us-profile-cta">
                  Create free account
                </Link>
              )}
            </div>

            {/* Main nav */}
            <nav className="us-nav">
              {mainNav.map((item) => {
                const active = isActive(item.href);
                const Icon = item.Icon;
                const showNavTitle = !isMobile && sidebarCollapsed;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`us-nav-link ${active ? "us-nav-link-active" : ""}`}
                    title={showNavTitle ? item.label : undefined}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <span className="us-nav-icon"><Icon size={18} /></span>
                    <span className="us-nav-label">{item.label}</span>
                    {item.href === "/user/notifications" && unreadNotifications > 0 && (
                      <span className="us-nav-badge">{unreadNotifications}</span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Divider */}
            <div className="us-nav-divider" />

            {/* Investing section */}
            {investingNav.length > 0 && (
              <>
                <div className="us-nav-section-title">
                  <span className="us-nav-label">Investing</span>
                  <FiChevronRight size={12} />
                </div>
                <nav className="us-nav">
                  {investingNav.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.Icon;
                    const showNavTitle = !isMobile && sidebarCollapsed;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`us-nav-link ${active ? "us-nav-link-active us-nav-link-invest" : ""}`}
                        title={showNavTitle ? item.label : undefined}
                        onClick={() => setMobileDrawerOpen(false)}
                      >
                        <span className="us-nav-icon"><Icon size={18} /></span>
                        <span className="us-nav-label">{item.label}</span>
                        {item.badge && (
                          <span className="us-nav-pill">{item.badge}</span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </>
            )}

            {/* Footer links */}
            <div className="us-sidebar-footer">
              <Link href="/user/settings" className="us-sidebar-footer-link">Settings</Link>
              <span className="us-sidebar-footer-dot">·</span>
              <Link href="#" className="us-sidebar-footer-link">Privacy</Link>
              <span className="us-sidebar-footer-dot">·</span>
              <span className="us-sidebar-footer-link">© {BRAND_NAME} {new Date().getFullYear()}</span>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="us-main theme-page">
          <div className="us-content theme-page">
            {currentUser ? (
              <WatchlistStoreProvider>{children}</WatchlistStoreProvider>
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="us-bottom-bar">
        {bottomNav.map((item) => {
          const active = isActive(item.href);
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`us-bottom-item ${active ? "us-bottom-item-active" : ""}`}
            >
              <span style={{ position: "relative", display: "flex" }}>
                <Icon size={22} />
                {item.href === "/user/notifications" && unreadNotifications > 0 && (
                  <span className="us-notif-dot" style={{ top: -2, right: -2 }} />
                )}
              </span>
              <span className="us-bottom-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
