"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ADMIN_MODULES, ADMIN_MODULE_ROUTE_MAP } from "../lib/admin-nav";
import { Bell } from "./advisor-ui/icons";

type ModeratorShellProps = {
  children: React.ReactNode;
  currentUser: {
    fullName: string;
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

  return (
    <div className="admin-shell advisor-scope" style={{ ["--advisor-primary" as any]: "#2563eb" }}>
      <aside className="admin-sidebar" style={{ background: "#f8fafc", padding: "20px 14px" }}>
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
                fontWeight: 800,
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
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: -0.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {currentUser.fullName}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                Platform Moderator
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              borderTop: "1px solid #eef0f4",
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

        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#94a3b8",
            letterSpacing: 1,
            marginBottom: 8,
            paddingLeft: 6,
          }}
        >
          MODERATION
        </div>

        <nav className="admin-nav">
          {ADMIN_MODULES.map((moduleName) => {
            const href = ADMIN_MODULE_ROUTE_MAP[moduleName];
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={moduleName}
                href={href}
                className={`admin-nav-link ${active ? "active" : ""}`}
              >
                {moduleName}
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="admin-content">
        <header
          className="admin-header"
          style={{ background: "#fff", borderBottom: "1px solid #eef0f4" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 420 }}>
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
                  color: "#94a3b8",
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
                  border: "1px solid #eef0f4",
                  background: "#f8fafc",
                  color: "#334155",
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
                    color: active ? "#2563eb" : "#64748b",
                    background: active ? "rgba(37, 99, 235, 0.08)" : "transparent",
                    textDecoration: "none",
                  }}
                >
                  {nav.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
            <Link
              href="/admin/audit-logs"
              aria-label="Activity"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#f8fafc",
                color: "#64748b",
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
                    border: "2px solid #f8fafc",
                  }}
                />
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
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
              {initials}
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: 48,
                  right: 0,
                  minWidth: 240,
                  background: "#fff",
                  border: "1px solid #eef0f4",
                  borderRadius: 12,
                  boxShadow: "0 12px 40px rgba(15, 23, 42, 0.1)",
                  padding: 8,
                  zIndex: 50,
                }}
              >
                <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #eef0f4" }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{currentUser.fullName}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{currentUser.email}</p>
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
                <Link
                  href="/admin/profile"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "10px",
                    borderRadius: 8,
                    color: "#0f172a",
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  Profile
                </Link>
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
        <main className="admin-main" style={{ background: "#f8fafc" }}>
          {children}
        </main>
      </section>
    </div>
  );
}
