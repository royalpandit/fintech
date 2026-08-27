"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import ThemeToggleMenu from "@/components/theme/theme-toggle-menu";
import PanelThemeToggle from "@/components/theme/panel-theme-toggle";
import { useTheme } from "@/components/theme/theme-provider";
import { ADMIN_MODULES, ADMIN_MODULE_ROUTE_MAP } from "../lib/admin-nav";
import { Bell } from "./advisor-ui/icons";
import FinuerLogo from "@/components/brand/finuer-logo";
import ShellMenuAvatar from "./shell-menu-avatar";
import { useDismissableMenu } from "@/hooks/use-dismissable-menu";
import PanelBackground from "@/components/motion/panel-background";

type ModeratorShellProps = {
  children: React.ReactNode;
  currentUser: {
    fullName: string;
    avatarUrl?: string | null;
    email: string;
    role: string;
  };
  pendingQueueCount: number;
  todayActionsCount: number;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const TOP_NAV = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Verifications", href: "/admin/advisors" },
  { label: "Posts", href: "/admin/market-posts" },
  { label: "Reports", href: "/admin/reports" },
  { label: "AI Agents", href: "/admin/agents" },
  { label: "Audit", href: "/admin/audit-logs" },
];

export default function ModeratorShell({
  children,
  currentUser,
  pendingQueueCount,
  todayActionsCount,
}: ModeratorShellProps) {
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

  return (
    <div className="admin-shell advisor-scope" style={{ ["--advisor-primary" as any]: "#2563eb" }}>
      <PanelBackground />
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
        {/* Profile card */}
        <div className="profile-card">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                background: "linear-gradient(135deg, #2563eb, #6366f1)",
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
                Platform Moderator
              </div>
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
              <div className="profile-card-label">Pending Queue</div>
              <div
                className="profile-card-stat"
                style={{ color: pendingQueueCount > 0 ? "#dc2626" : "#16a34a" }}
              >
                {pendingQueueCount}
              </div>
            </div>
            <div>
              <div className="profile-card-label">Actions Today</div>
              <div className="profile-card-stat">{todayActionsCount}</div>
            </div>
          </div>
        </div>

        <nav className="admin-nav">
          <div className="admin-nav-group">
            <div className="admin-nav-heading">Moderation</div>
            {ADMIN_MODULES.map((moduleName) => {
              const href = ADMIN_MODULE_ROUTE_MAP[moduleName];
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={moduleName}
                  href={href}
                  className={`admin-nav-link ${active ? "active" : ""}`}
                  onClick={() => setNavOpen(false)}
                >
                  <span className="admin-nav-icon" aria-hidden>
                    <span className="admin-nav-dot" />
                  </span>
                  <span className="admin-nav-label">{moduleName}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      <section className="admin-content">
        <header
          className="admin-header"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, maxWidth: 420 }}>
            <button
              type="button"
              className="admin-nav-hamburger"
              aria-label="Open navigation menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <FiMenu size={20} />
            </button>
            <div style={{ position: "relative", width: "100%" }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path
                  d="m20 20-3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <input
                placeholder="Search advisors, posts, reports..."
                style={{
                  width: "100%",
                  height: 40,
                  paddingLeft: 38,
                  paddingRight: 14,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <nav style={{ display: "flex", gap: 4, alignItems: "center", margin: "0 auto" }}>
            {TOP_NAV.map((nav) => {
              const active = pathname === nav.href || pathname.startsWith(nav.href + "/");
              return (
                <Link
                  key={nav.href}
                  href={nav.href}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: active ? "#2563eb" : "var(--text-muted)",
                    background: active ? "rgba(37, 99, 235, 0.08)" : "transparent",
                    textDecoration: "none",
                  }}
                >
                  {nav.label}
                </Link>
              );
            })}
          </nav>

          <div
            ref={accountMenuRef}
            style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", marginLeft: 24, flexShrink: 0 }}
          >
            <Link
              href="/admin/audit-logs"
              aria-label="Activity"
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
              {pendingQueueCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "#dc2626",
                    border: "2px solid var(--surface)",
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
                background: "linear-gradient(135deg, #2563eb, #6366f1)",
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
                    gradient="linear-gradient(135deg, #2563eb, #6366f1)"
                  />
                  <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.fullName}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.email}</p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      display: "inline-block",
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(37, 99, 235, 0.1)",
                      color: "#2563eb",
                      textTransform: "capitalize",
                      fontWeight: 700,
                    }}
                  >
                    {currentUser.role}
                  </p>
                  </div>
                </div>
                <Link
                  href="/admin/profile"
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
          {children}
        </main>
      </section>
    </div>
  );
}
