"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FiMenu,
  FiX,
  FiPieChart,
  FiBarChart2,
  FiUsers,
  FiUserCheck,
  FiShield,
  FiActivity,
  FiMessageSquare,
  FiFileText,
  FiCpu,
  FiLayers,
  FiAward,
  FiBookOpen,
  FiCreditCard,
  FiStar,
  FiDollarSign,
  FiBell,
  FiClipboard,
  FiSettings,
} from "react-icons/fi";
import { TbRobot } from "react-icons/tb";
import type { IconType } from "react-icons";
import FinuerLogo from "@/components/brand/finuer-logo";
import ThemeToggleMenu from "@/components/theme/theme-toggle-menu";
import PanelThemeToggle from "@/components/theme/panel-theme-toggle";
import { useTheme } from "@/components/theme/theme-provider";
import { MODULE_ROUTE_MAP, NAV_GROUPS } from "../lib/super-admin";
import { Bell } from "./advisor-ui/icons";
import CommandPalette from "./command-palette";
import ShellMenuAvatar from "./shell-menu-avatar";
import { useDismissableMenu } from "@/hooks/use-dismissable-menu";
import PanelBackground from "@/components/motion/panel-background";
import { ToastProvider } from "./toast";

/**
 * One icon per sidebar module, mirroring the advisor console's MODULE_ICONS.
 *
 * Every row here used to render `.admin-nav-dot` — the neutral fallback marker
 * meant for a module with no icon — because no icon map existed. That gave the
 * whole super-admin sidebar a column of identical grey bullets, so the nav read
 * as a bulleted list rather than as navigation, and it looked nothing like the
 * advisor shell beside it. Keys match NAV_GROUPS in lib/super-admin.ts exactly;
 * anything unmapped still falls back to the dot rather than breaking the row.
 */
const MODULE_ICONS: Record<string, IconType> = {
  Dashboard: FiPieChart,
  Analytics: FiBarChart2,
  Users: FiUsers,
  Advisors: FiUserCheck,
  Permissions: FiShield,
  "Buy Sell Trade Posts": FiActivity,
  Community: FiMessageSquare,
  Reports: FiFileText,
  "AI & Compliance": FiCpu,
  "AI Agents": TbRobot,
  "Finuer Basket": FiLayers,
  Competition: FiAward,
  Courses: FiBookOpen,
  Subscriptions: FiCreditCard,
  "Finuer Pro Plans": FiStar,
  Sponsorship: FiAward,
  Payments: FiDollarSign,
  Notifications: FiBell,
  "Audit Logs": FiClipboard,
  Settings: FiSettings,
};

type AdminShellProps = {
  children: React.ReactNode;
  currentUser: {
    fullName: string;
    avatarUrl?: string | null;
    email: string;
    role: string;
  };
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminShell({ children, currentUser }: AdminShellProps) {
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

  const initials = getInitials(currentUser.fullName);

  // Outside click + Escape dismiss the account menu; Escape refocuses the
  // avatar button so keyboard users don't lose their place.
  const { containerRef: accountMenuRef, triggerRef: avatarBtnRef } = useDismissableMenu<
    HTMLDivElement,
    HTMLButtonElement
  >(menuOpen, () => setMenuOpen(false));

  // Close the mobile nav drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
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

  // Escape closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div
      className="admin-shell advisor-scope"
      style={
        {
          // Emerald "Finuer" theme, scoped to the super-admin console only.
          "--advisor-primary": "#10b981",
          "--advisor-primary-deep": "#047857",
          "--advisor-accent": "#14b8a6",
          "--primary": "#10b981",
          "--primary-2": "#34d399",
          "--primary-soft": "rgba(16, 185, 129, 0.12)",
          // Blue is the brand's secondary accent — used for data/analytics.
          "--accent-blue": "#2563eb",
          "--accent-blue-soft": "rgba(37, 99, 235, 0.12)",
          "--nav-active-gradient":
            "linear-gradient(135deg, #059669 0%, #10b981 55%, #34d399 100%)",
          "--nav-active-shadow": "0 4px 14px rgba(16, 185, 129, 0.28)",
        } as React.CSSProperties
      }
    >
      <PanelBackground />
      {navOpen && (
        <div
          className="admin-nav-overlay"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`admin-sidebar${navOpen ? " admin-sidebar-open" : ""}`}
        style={{ background: "var(--surface-2)", padding: "18px 14px" }}
      >
        <div
          style={{
            marginBottom: 18,
            paddingLeft: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <FinuerLogo href="/" height={36} className="shell-brand-logo" />
          <button
            type="button"
            className="admin-nav-close"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Profile card — identity only (revenue/growth moved to the dashboard) */}
        <div className="profile-card">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                overflow: "hidden",
                background: "linear-gradient(135deg, #10b981, #14b8a6)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 600,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {currentUser.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentUser.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
              ) : (
                initials
              )}
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
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                Super Admin
              </div>
            </div>
          </div>
        </div>

        {/* Same grouped markup the advisor sidebar now uses — headings and link
            styling live in globals.css so the two shells can't drift. */}
        <nav className="admin-nav">
          {NAV_GROUPS.map((group) => {
            const items = group.modules.filter((m) => MODULE_ROUTE_MAP[m]);
            if (items.length === 0) return null;
            return (
              <div key={group.heading} className="admin-nav-group">
                <div className="admin-nav-heading">{group.heading}</div>
                {items.map((moduleName) => {
                  const Icon = MODULE_ICONS[moduleName];
                  return (
                    <Link
                      key={moduleName}
                      href={MODULE_ROUTE_MAP[moduleName]}
                      className={`admin-nav-link ${isActive(MODULE_ROUTE_MAP[moduleName]) ? "active" : ""}`}
                      onClick={() => setNavOpen(false)}
                    >
                      <span className="admin-nav-icon" aria-hidden>
                        {Icon ? <Icon size={17} /> : <span className="admin-nav-dot" />}
                      </span>
                      <span className="admin-nav-label">{moduleName}</span>
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
            <CommandPalette />
          </div>

          <div
            ref={accountMenuRef}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              position: "relative",
              marginLeft: 24,
              flexShrink: 0,
            }}
          >
            <Link
              href="/super-admin/notifications"
              aria-label="Notifications"
              title="Notifications"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--surface-2)",
                color: "var(--text-muted)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Bell size={18} />
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
                overflow: "hidden",
                background: "linear-gradient(135deg, #10b981, #14b8a6)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 12,
                border: "none",
                cursor: "pointer",
              }}
            >
              {currentUser.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentUser.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
              ) : (
                initials
              )}
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
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 10px 10px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <ShellMenuAvatar
                    src={currentUser.avatarUrl}
                    initials={initials}
                    gradient="linear-gradient(135deg, #10b981, #14b8a6)"
                  />
                  <div style={{ minWidth: 0 }}>
                  <p className="admin-theme-dropdown-name" style={{ margin: 0, fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {currentUser.fullName}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.email}</p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      display: "inline-block",
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(16, 185, 129, 0.1)",
                      color: "#047857",
                      textTransform: "capitalize",
                      fontWeight: 700,
                    }}
                  >
                    {currentUser.role.replace("_", " ")}
                  </p>
                  </div>
                </div>
                <Link
                  href="/super-admin/profile"
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
                  href="/super-admin/settings"
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
                  Settings
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
          <ToastProvider>{children}</ToastProvider>
        </main>
      </section>
    </div>
  );
}
