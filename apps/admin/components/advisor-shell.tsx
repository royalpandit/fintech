"use client";

import Link from "next/link";
import { ToastProvider } from "@/components/toast";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FiMenu,
  FiX,
  FiPieChart,
  FiBarChart2,
  FiHome,
  FiActivity,
  FiMessageSquare,
  FiPackage,
  FiFileText,
  FiBookOpen,
  FiDollarSign,
  FiTrendingUp,
  FiStar,
  FiLayers,
  FiBriefcase,
  FiAward,
  FiMessageCircle,
  FiBell,
  FiUser,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import FinuerLogo from "@/components/brand/finuer-logo";
import ThemeToggleMenu from "@/components/theme/theme-toggle-menu";
import PanelThemeToggle from "@/components/theme/panel-theme-toggle";
import { useTheme } from "@/components/theme/theme-provider";
import { ADVISOR_NAV_GROUPS, ADVISOR_MODULE_ROUTE_MAP } from "../lib/advisor-nav";
import { Bell } from "./advisor-ui/icons";
import AdvisorSearch from "./advisor-search";
import ShellMenuAvatar from "./shell-menu-avatar";
import { useDismissableMenu } from "@/hooks/use-dismissable-menu";

/**
 * One icon per sidebar module, so the advisor console reads like the investor
 * shell instead of a wall of text. Keys match ADVISOR_MODULES exactly — a module
 * with no entry falls back to a neutral dot rather than breaking the row.
 */
const MODULE_ICONS: Record<string, IconType> = {
  Dashboard: FiPieChart,
  Analytics: FiBarChart2,
  Feed: FiHome,
  "Buy Sell Trade Posts": FiActivity,
  Comments: FiMessageSquare,
  "Subscription Services": FiPackage,
  Reports: FiFileText,
  Courses: FiBookOpen,
  Earnings: FiDollarSign,
  Markets: FiTrendingUp,
  Watchlist: FiStar,
  "Finuer Basket": FiLayers,
  "Virtual Trading": FiBriefcase,
  Competitions: FiAward,
  Messages: FiMessageCircle,
  Notifications: FiBell,
  Profile: FiUser,
};

type AdvisorShellProps = {
  children: React.ReactNode;
  currentUser: {
    fullName: string;
    email: string;
    sebiRegistrationNo: string | null;
    profileImageUrl?: string | null;
  };
  badges?: Partial<Record<string, number>>;
  walletBalance: number;
  todayDelta: { current: number; previous: number };
  needsVerification?: boolean;
  /** Modules to hide from the sidebar (e.g. Subscription Services for listed companies). */
  hiddenModules?: string[];
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatINRCompact(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

function deltaPct(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function AdvisorShell({
  children,
  currentUser,
  badges = {},
  walletBalance,
  todayDelta,
  needsVerification = false,
  hiddenModules = [],
}: AdvisorShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { enterThemedScope, exitThemedScope } = useTheme();

  // Light is opt-in per panel: outside the signed-in shells every route renders
  // the product's dark appearance. Adopt the stored preference while this panel
  // is mounted and hand the page back to dark on the way out, so the choice
  // survives without leaking onto the landing or auth pages.
  useEffect(() => {
    enterThemedScope();
    return () => exitThemedScope();
  }, [enterThemedScope, exitThemedScope]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const hiddenSet = new Set(hiddenModules);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const apply = () => {
      document.body.style.overflow = mq.matches && navOpen ? "hidden" : "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // While unverified, every feature link routes to the verification page so the
  // advisor must "verify first" before opening posts, subscribers, etc. The
  // dashboard stays reachable so they can still see the alert banner.
  const lockedHref = (target: string) =>
    needsVerification && target !== "/advisor/dashboard" ? "/advisor/verify" : target;

  const initials = getInitials(currentUser.fullName);

  // Outside click + Escape dismiss the account menu; Escape refocuses the
  // avatar button so keyboard users don't lose their place.
  const { containerRef: accountMenuRef, triggerRef: avatarBtnRef } = useDismissableMenu<
    HTMLDivElement,
    HTMLButtonElement
  >(menuOpen, () => setMenuOpen(false));
  const avatarUrl = currentUser.profileImageUrl;
  const todayDeltaPct = deltaPct(todayDelta.current, todayDelta.previous);
  const todayDeltaSign = todayDeltaPct >= 0 ? "+" : "";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  // The badge counts come from a server render, so a notification arriving
  // while the advisor sits on a page would stay invisible until a full reload.
  // Poll the unread count and refresh it whenever the tab regains focus.
  const [liveUnread, setLiveUnread] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/v1/advisor/notifications?filter=unread", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        const count =
          typeof json.unreadCount === "number"
            ? json.unreadCount
            : Array.isArray(json.data)
              ? json.data.length
              : null;
        if (!cancelled && count != null) setLiveUnread(count);
      } catch {
        // offline — retry on the next tick
      }
    };
    void pull();
    const id = setInterval(pull, 20_000);
    const onFocus = () => void pull();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const totalUnread =
    (liveUnread ?? badges.Notifications ?? 0) + (badges.Comments ?? 0);

  return (
    <div className="admin-shell advisor-scope">
      {navOpen && (
        <div className="admin-nav-overlay" onClick={() => setNavOpen(false)} aria-hidden="true" />
      )}
      <aside
        className={`admin-sidebar${navOpen ? " admin-sidebar-open" : ""}`}
        style={{ background: "var(--surface-2)", padding: "20px 14px" }}
      >
        <div
          style={{
            marginBottom: 16,
            paddingLeft: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <FinuerLogo href="/" height={34} />
          <button
            type="button"
            className="admin-nav-close"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          >
            <FiX size={20} />
          </button>
        </div>
        {/* Profile card at the top */}
        <div className="profile-card">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                background: avatarUrl
                  ? `var(--surface-2) url(${avatarUrl}) center/cover no-repeat`
                  : "linear-gradient(135deg, #2563eb, #10b981)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 600,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {!avatarUrl && initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  letterSpacing: -0.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {currentUser.fullName}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>SEBI Advisor</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              borderTop: "1px solid var(--border)",
              paddingTop: 10,
            }}
          >
            <div>
              <div className="profile-card-label">
                Wallet Balance
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: "var(--surface-2)",
                    color: "var(--text-muted)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 9,
                  }}
                >
                  i
                </span>
              </div>
              <div className="profile-card-stat">{formatINRCompact(walletBalance)}</div>
            </div>
            <div>
              <div className="profile-card-label">Today&apos;s Revenue</div>
              <div
                className="profile-card-stat"
                style={{
                  color: todayDeltaPct >= 0 ? "#16a34a" : "#dc2626",
                }}
              >
                {todayDeltaSign}
                {Math.abs(todayDeltaPct).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Grouped like the super-admin sidebar, with the investor shell's icons.
            It used to flatten the groups and drop their headings, leaving 17
            undifferentiated links. */}
        <nav className="admin-nav">
          {ADVISOR_NAV_GROUPS.map((group) => {
            const items = group.modules.filter(
              (m) => !hiddenSet.has(m) && ADVISOR_MODULE_ROUTE_MAP[m],
            );
            // A group whose every module is hidden (unverified advisor, a
            // capability they lack) must not leave a dangling heading.
            if (items.length === 0) return null;

            return (
              <div key={group.heading} className="admin-nav-group">
                <div className="admin-nav-heading">{group.heading}</div>
                {items.map((moduleName) => {
                  const href = ADVISOR_MODULE_ROUTE_MAP[moduleName];
                  const active = pathname === href || pathname.startsWith(href + "/");
                  const badgeCount = badges[moduleName] ?? 0;
                  const Icon = MODULE_ICONS[moduleName];
                  return (
                    <Link
                      key={moduleName}
                      href={lockedHref(href)}
                      className={`admin-nav-link ${active ? "active" : ""}`}
                      onClick={() => setNavOpen(false)}
                    >
                      <span className="admin-nav-icon" aria-hidden>
                        {Icon ? <Icon size={17} /> : <span className="admin-nav-dot" />}
                      </span>
                      <span className="admin-nav-label">{moduleName}</span>
                      {badgeCount > 0 && (
                        <span
                          className="admin-nav-count"
                          style={{
                            background:
                              moduleName === "Comments"
                                ? "#dc2626"
                                : active
                                  ? "rgba(255,255,255,0.3)"
                                  : "#2563eb",
                          }}
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <section className="admin-content">
        <header
          className="admin-header"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
        >
          {/* Functional search (stocks + page nav, ⌘K) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, maxWidth: 460 }}>
            <button
              type="button"
              className="admin-nav-hamburger"
              aria-label="Open navigation menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <FiMenu size={20} />
            </button>
            {!needsVerification && <AdvisorSearch />}
          </div>

          {/* Right side: notifications + avatar */}
          <div
            ref={accountMenuRef}
            style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", marginLeft: 24, flexShrink: 0 }}
          >
            <Link
              href={lockedHref("/advisor/notifications")}
              aria-label="Notifications"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--surface-2)",
                color: "var(--text-muted)",
                display: "grid",
                placeItems: "center",
                position: "relative",
              }}
            >
              <Bell size={18} />
              {totalUnread > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "#dc2626",
                    border: "2px solid var(--surface-2)",
                  }}
                />
              )}
            </Link>

            <PanelThemeToggle />

            <button
              ref={avatarBtnRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={currentUser.fullName}
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                background: avatarUrl
                  ? `var(--surface-2) url(${avatarUrl}) center/cover no-repeat`
                  : "linear-gradient(135deg, #2563eb, #10b981)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 12,
                border: "none",
                cursor: "pointer",
              }}
            >
              {!avatarUrl && initials}
            </button>

            {menuOpen && (
              <div
                className="admin-theme-dropdown"
                style={{
                  position: "absolute",
                  top: 48,
                  right: 0,
                  minWidth: 240,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "0 12px 40px rgba(15, 23, 42, 0.1)",
                  padding: 8,
                  zIndex: 50,
                }}
              >
                <div
                  className="admin-theme-dropdown-head"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px 10px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <ShellMenuAvatar
                    src={avatarUrl}
                    initials={initials}
                    gradient="linear-gradient(135deg, #2563eb, #10b981)"
                  />
                  <div style={{ minWidth: 0 }}>
                    <p
                      className="admin-theme-dropdown-name"
                      style={{ margin: 0, fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {currentUser.fullName}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {currentUser.email}
                    </p>
                  </div>
                </div>
                <Link
                  href={lockedHref("/advisor/profile")}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "10px",
                    borderRadius: 8,
                    color: "var(--text)",
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  Profile
                </Link>
                <Link
                  href={lockedHref("/advisor/earnings")}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "10px",
                    borderRadius: 8,
                    color: "var(--text)",
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  Earnings
                </Link>
                <ThemeToggleMenu onSelect={() => setMenuOpen(false)} />
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#dc2626",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loggingOut ? "not-allowed" : "pointer",
                  }}
                >
                  {loggingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="admin-main theme-page">
          {needsVerification && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
                padding: "12px 16px",
                marginBottom: 16,
                borderRadius: 12,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.35)",
                position: "sticky",
                top: 12,
                zIndex: 20,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--brand-danger)" }}>
                    Complete your verification
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Verify that you&apos;re a SEBI / government-registered advisor to unlock
                    posting, subscribers, and earnings.
                  </div>
                </div>
              </div>
              <Link
                href="/advisor/verify"
                style={{
                  flexShrink: 0,
                  padding: "10px 18px",
                  borderRadius: 10,
                  background: "var(--brand-danger)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Complete verification →
              </Link>
            </div>
          )}
          <ToastProvider>{children}</ToastProvider>
        </main>
      </section>
    </div>
  );
}
