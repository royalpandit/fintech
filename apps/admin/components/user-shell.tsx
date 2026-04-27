"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell } from "./advisor-ui/icons";

type UserShellProps = {
  children: React.ReactNode;
  currentUser: { fullName: string; email: string } | null;
  unreadNotifications: number;
};

const TOP_NAV = [
  { label: "Home", href: "/user/home" },
  { label: "Markets", href: "/user/markets" },
  { label: "Advisors", href: "/user/advisors" },
  { label: "Lab", href: "/user/lab" },
  { label: "Learn", href: "/user/learn" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserShell({
  children,
  currentUser,
  unreadNotifications,
}: UserShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = currentUser ? getInitials(currentUser.fullName) : "";

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

  return (
    <div
      className="advisor-scope"
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        ["--advisor-primary" as any]: "#0ea5e9",
      }}
    >
      {/* Top navigation */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255, 255, 255, 0.92)",
          borderBottom: "1px solid #eef0f4",
          backdropFilter: "saturate(160%) blur(10px)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* Logo */}
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

          {/* Search bar */}
          <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
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
              placeholder="Search advisors, symbols, courses..."
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

          {/* Top nav */}
          <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
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

          {/* Right side: auth-aware */}
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
                      My Portfolio
                    </Link>
                    <Link
                      href="/user/lab"
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
                      Virtual Lab
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

      <main
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "20px 24px 60px",
        }}
      >
        {children}
      </main>

      <footer
        style={{
          borderTop: "1px solid #eef0f4",
          background: "#fff",
          padding: "20px 24px",
          marginTop: 40,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "#64748b",
          }}
        >
          <span>© 2026 Corescent — Regulated AI-Powered Financial Network</span>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="#" style={{ color: "inherit" }}>
              Privacy
            </a>
            <a href="#" style={{ color: "inherit" }}>
              Terms
            </a>
            <a href="#" style={{ color: "inherit" }}>
              Compliance
            </a>
            <a href="#" style={{ color: "inherit" }}>
              Help
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
