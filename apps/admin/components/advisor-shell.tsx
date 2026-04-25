"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ADVISOR_MODULES, ADVISOR_MODULE_ROUTE_MAP } from "../lib/advisor-nav";
import { Bell } from "./advisor-ui/icons";

type AdvisorShellProps = {
  children: React.ReactNode;
  currentUser: {
    fullName: string;
    email: string;
    sebiRegistrationNo: string | null;
  };
  badges?: Partial<Record<string, number>>;
  walletBalance: number;
  todayDelta: { current: number; previous: number };
};

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
}: AdvisorShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = getInitials(currentUser.fullName);
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

  const totalUnread = (badges.Notifications ?? 0) + (badges.Comments ?? 0);

  return (
    <div className="admin-shell advisor-scope">
      <aside className="admin-sidebar" style={{ background: "#f8fafc", padding: "20px 14px" }}>
        {/* Profile card at the top */}
        <div className="profile-card">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                background: "linear-gradient(135deg, #2563eb, #10b981)",
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
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>SEBI Advisor</div>
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
              <div className="profile-card-label">
                Wallet Balance
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: "#eef0f4",
                    color: "#94a3b8",
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
          ADVISOR
        </div>

        <nav className="admin-nav">
          {ADVISOR_MODULES.map((moduleName) => {
            const href = ADVISOR_MODULE_ROUTE_MAP[moduleName];
            const active = pathname === href || pathname.startsWith(href + "/");
            const badgeCount = badges[moduleName] ?? 0;
            return (
              <Link
                key={moduleName}
                href={href}
                className={`admin-nav-link ${active ? "active" : ""}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span>{moduleName}</span>
                {badgeCount > 0 && (
                  <span
                    style={{
                      padding: "1px 8px",
                      borderRadius: 999,
                      background:
                        moduleName === "Comments"
                          ? "#dc2626"
                          : active
                            ? "rgba(255,255,255,0.3)"
                            : "#2563eb",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      minWidth: 20,
                      textAlign: "center",
                    }}
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
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
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 420 }}>
            <div
              style={{
                position: "relative",
                width: "100%",
              }}
            >
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
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                placeholder="Search posts, subscribers, courses..."
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

          {/* Top page tabs */}
          <nav style={{ display: "flex", gap: 4, alignItems: "center", margin: "0 auto" }}>
            {[
              { label: "Overview", href: "/advisor/dashboard" },
              { label: "Posts", href: "/advisor/posts" },
              { label: "Subscribers", href: "/advisor/subscribers" },
              { label: "Earnings", href: "/advisor/earnings" },
              { label: "Profile", href: "/advisor/profile" },
            ].map((nav) => {
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
                  {active && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      style={{ marginLeft: 4, verticalAlign: "middle" }}
                    >
                      <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </svg>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side: notifications + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
            <Link
              href="/advisor/notifications"
              aria-label="Notifications"
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
                background: "linear-gradient(135deg, #2563eb, #10b981)",
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
                </div>
                <Link
                  href="/advisor/profile"
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
                <Link
                  href="/advisor/earnings"
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
                  Earnings
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
