"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import FinuerLogo from "@/components/brand/finuer-logo";
import ThemeToggleMenu from "@/components/theme/theme-toggle-menu";
import ThemeHeaderButton from "@/components/theme/theme-header-button";
import { MODULE_ROUTE_MAP, NAV_GROUPS } from "../lib/super-admin";
import { Bell } from "./advisor-ui/icons";
import CommandPalette from "./command-palette";
import { ToastProvider } from "./toast";

type AdminShellProps = {
  children: React.ReactNode;
  currentUser: {
    fullName: string;
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
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = getInitials(currentUser.fullName);

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
      <aside
        className="admin-sidebar"
        style={{ background: "var(--surface-2)", padding: "18px 14px" }}
      >
        <div style={{ marginBottom: 18, paddingLeft: 4 }}>
          <FinuerLogo href="/" height={44} />
        </div>

        {/* Profile card — identity only (revenue/growth moved to the dashboard) */}
        <div className="profile-card">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                background: "linear-gradient(135deg, #10b981, #14b8a6)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 600,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {initials}
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

        <nav className="admin-nav" style={{ display: "grid", gap: 4 }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.heading} style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  letterSpacing: 1,
                  margin: "0 0 6px",
                  paddingLeft: 6,
                  textTransform: "uppercase",
                }}
              >
                {group.heading}
              </div>
              {group.modules.map((moduleName) => {
                const href = MODULE_ROUTE_MAP[moduleName];
                if (!href) return null;
                return (
                  <Link
                    key={moduleName}
                    href={href}
                    className={`admin-nav-link ${isActive(href) ? "active" : ""}`}
                  >
                    {moduleName}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <section className="admin-content">
        <header
          className="admin-header"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 460 }}>
            <CommandPalette />
          </div>

          <div
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

            <ThemeHeaderButton />

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              title={currentUser.fullName}
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
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
              {initials}
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
                  style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--border)" }}
                >
                  <p className="admin-theme-dropdown-name" style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>
                    {currentUser.fullName}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{currentUser.email}</p>
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
