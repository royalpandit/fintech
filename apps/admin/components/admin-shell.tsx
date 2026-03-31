"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULE_ROUTE_MAP, SUPER_ADMIN_MODULES } from "../lib/super-admin";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">Flexi Super Admin</div>
        <nav className="admin-nav">
          {SUPER_ADMIN_MODULES.map((moduleName) => {
            const href = MODULE_ROUTE_MAP[moduleName];
            const active = pathname === href;

            return (
              <Link key={moduleName} href={href} className={`admin-nav-link ${active ? "active" : ""}`}>
                {moduleName}
              </Link>
            );
          })}
        </nav>
      </aside>
      <section className="admin-content">
        <header className="admin-header">
          <input className="admin-header-search" placeholder="Search across console..." />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href="/super-admin/settings"
              aria-label="Open settings"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-muted)",
                display: "grid",
                placeItems: "center",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              ⚙
            </Link>
            <span className="tag">Online</span>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "linear-gradient(120deg, #0058ba, #6c9fff)",
                color: "white",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              AV
            </div>
          </div>
        </header>
        <main className="admin-main">{children}</main>
      </section>
    </div>
  );
}

