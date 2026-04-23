"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ADVISOR_MODULES, ADVISOR_MODULE_ROUTE_MAP } from "../lib/advisor-nav";

type AdvisorShellProps = {
  children: React.ReactNode;
  currentUser: {
    fullName: string;
    email: string;
    sebiRegistrationNo: string | null;
  };
  badges?: Partial<Record<string, number>>;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdvisorShell({ children, currentUser, badges = {} }: AdvisorShellProps) {
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
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand" style={{ background: "linear-gradient(120deg, #047857, #059669)" }}>
          Corescent Advisor
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
                      background: moduleName === "Comments" ? "#dc2626" : "#2563eb",
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
        <div
          style={{
            marginTop: "auto",
            padding: 12,
            fontSize: 11,
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border)",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, color: "#059669" }}>✓ Verified Advisor</div>
          <div>{currentUser.sebiRegistrationNo ?? "—"}</div>
        </div>
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <Link
            href="/advisor/posts/new"
            className="btn-primary"
            style={{ padding: "10px 16px", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            + New Market Post
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", marginLeft: "auto" }}>
            <span className="tag success">SEBI Verified</span>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              title={currentUser.fullName}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "linear-gradient(120deg, #047857, #10b981)",
                color: "white",
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
                  minWidth: 260,
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  boxShadow: "0 12px 40px rgba(15, 23, 42, 0.12)",
                  padding: 12,
                  zIndex: 50,
                }}
              >
                <div style={{ padding: "8px 8px 12px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{currentUser.fullName}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    {currentUser.email}
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      display: "inline-block",
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#d1fae5",
                      color: "#047857",
                      fontWeight: 600,
                    }}
                  >
                    Advisor
                  </p>
                </div>
                <Link
                  href="/advisor/profile"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "10px 8px",
                    borderRadius: 8,
                    color: "var(--text)",
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                >
                  Profile
                </Link>
                <Link
                  href="/advisor/earnings"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "10px 8px",
                    borderRadius: 8,
                    color: "var(--text)",
                    textDecoration: "none",
                    fontSize: 14,
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
                    padding: "10px 8px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#dc2626",
                    fontSize: 14,
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
        <main className="admin-main">{children}</main>
      </section>
    </div>
  );
}
