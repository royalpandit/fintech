"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell } from "./advisor-ui/icons";

type UserShellProps = {
  children: React.ReactNode;
  currentUser: { fullName: string; email: string } | null;
  unreadNotifications: number;
  walletBalance: number;
  todayPnL: number;
  todayPnLPct: number;
};

const MAIN_NAV = [
  { label: "Feed", href: "/user/home", icon: "📰" },
  { label: "Advisors", href: "/user/advisors", icon: "👥" },
  { label: "Markets", href: "/user/markets", icon: "📈" },
  { label: "Groups", href: "/user/community", icon: "💬" },
  { label: "Notifications", href: "/user/notifications", icon: "🔔" },
  { label: "Settings", href: "/user/settings", icon: "⚙" },
];

const INVESTING_NAV = [
  { label: "Dashboard", href: "/user/home", icon: "📊" },
  { label: "Watchlist", href: "/user/watchlist", icon: "⭐" },
  { label: "Portfolio", href: "/user/portfolio", icon: "💼" },
  { label: "Virtual Lab", href: "/user/lab", icon: "🧪", badge: "New" },
  { label: "Trade History", href: "/user/history", icon: "🕒" },
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
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = currentUser ? getInitials(currentUser.fullName) : "G";
  const pnlColor = todayPnL >= 0 ? "#16a34a" : "#dc2626";
  const pnlSign = todayPnL >= 0 ? "+" : "";

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

  const isInvestingActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div
      className="advisor-scope"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        ["--advisor-primary" as any]: "#0ea5e9",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255, 255, 255, 0.94)",
          borderBottom: "1px solid #eef0f4",
          backdropFilter: "saturate(160%) blur(10px)",
        }}
      >
        <div
          style={{
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <Link
            href="/user/home"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "linear-gradient(135deg, #0ea5e9, #10b981)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              C
            </div>
            <span
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: -0.4,
              }}
            >
              Corescent
            </span>
          </Link>

          <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
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
              placeholder="Search advisors, symbols, courses..."
              style={{
                width: "100%",
                height: 40,
                paddingLeft: 38,
                paddingRight: 14,
                borderRadius: 999,
                border: "1px solid #eef0f4",
                background: "#f8fafc",
                color: "#334155",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          <nav style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: "auto" }}>
            {[
              { label: "Demo", href: "#" },
              { label: "Markets", href: "/user/markets" },
              { label: "Advisors", href: "/user/advisors" },
              { label: "Account", href: "/user/profile" },
            ].map((nav) => {
              const active = nav.href !== "#" && (pathname === nav.href || pathname.startsWith(nav.href + "/"));
              return (
                <Link
                  key={nav.label}
                  href={nav.href}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: active ? "#0ea5e9" : "#475569",
                    background: active ? "rgba(14, 165, 233, 0.08)" : "transparent",
                    textDecoration: "none",
                  }}
                >
                  {nav.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            {currentUser ? (
              <>
                <Link
                  href="/user/notifications"
                  aria-label="Notifications"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#f8fafc",
                    color: "#475569",
                    display: "grid",
                    placeItems: "center",
                    position: "relative",
                  }}
                >
                  <Bell size={18} />
                  {unreadNotifications > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "#dc2626",
                        border: "2px solid #fff",
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
                    background: "linear-gradient(135deg, #0ea5e9, #10b981)",
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
                      boxShadow: "0 12px 40px rgba(15, 23, 42, 0.12)",
                      padding: 8,
                      zIndex: 50,
                    }}
                  >
                    <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #eef0f4" }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>
                        {currentUser.fullName}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                        {currentUser.email}
                      </p>
                    </div>
                    <Link
                      href="/user/profile"
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
                      href="/user/portfolio"
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
                      Portfolio
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
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0f172a",
                    textDecoration: "none",
                  }}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  style={{
                    padding: "9px 18px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #0ea5e9, #10b981)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 3-pane layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 0,
          maxWidth: 1440,
          margin: "0 auto",
          padding: "20px 20px 60px",
        }}
      >
        {/* Left sidebar */}
        <aside
          style={{
            paddingRight: 16,
            borderRight: "1px solid #eef0f4",
          }}
        >
          {/* Profile card */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #eef0f4",
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  background: currentUser
                    ? "linear-gradient(135deg, #0ea5e9, #10b981)"
                    : "linear-gradient(135deg, #94a3b8, #64748b)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 14,
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
                  {currentUser?.fullName ?? "Guest Visitor"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                  {currentUser ? "Investor" : "Sign in to personalize"}
                </div>
              </div>
            </div>

            {currentUser ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 10,
                    borderTop: "1px solid #eef0f4",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                    Virtual Balance ⓘ
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#0f172a",
                      letterSpacing: -0.3,
                    }}
                  >
                    {formatINR(walletBalance)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 6,
                  }}
                >
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                    Today&apos;s P&amp;L
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: pnlColor,
                      letterSpacing: -0.3,
                    }}
                  >
                    {pnlSign}
                    {formatINRCompact(Math.abs(todayPnL))} ({pnlSign}
                    {todayPnLPct.toFixed(2)}%)
                  </span>
                </div>
              </>
            ) : (
              <Link
                href="/register"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0ea5e9, #10b981)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                  marginTop: 4,
                }}
              >
                Create free account
              </Link>
            )}
          </div>

          {/* Main nav */}
          <nav style={{ display: "grid", gap: 2, marginBottom: 16 }}>
            {MAIN_NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    color: active ? "#0ea5e9" : "#475569",
                    background: active ? "rgba(14, 165, 233, 0.08)" : "transparent",
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Investing section */}
          <div
            style={{
              padding: "0 12px 8px",
              fontSize: 10,
              fontWeight: 700,
              color: "#94a3b8",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Investing
          </div>
          <nav style={{ display: "grid", gap: 2 }}>
            {INVESTING_NAV.map((item) => {
              const active = isInvestingActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    color: active ? "#fff" : "#475569",
                    background: active
                      ? "linear-gradient(90deg, #0ea5e9, #10b981)"
                      : "transparent",
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: active ? "0 6px 16px rgba(14, 165, 233, 0.2)" : "none",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        padding: "1px 8px",
                        borderRadius: 999,
                        background: active ? "rgba(255,255,255,0.25)" : "#10b981",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main style={{ paddingLeft: 20, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
