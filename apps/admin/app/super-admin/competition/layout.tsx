"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SUBNAV = [
  { label: "Competition List", href: "/super-admin/competition/list" },
  { label: "Create Competition", href: "/super-admin/competition/create" },
  { label: "Participants", href: "/super-admin/competition/participants" },
  { label: "Leaderboard", href: "/super-admin/competition/leaderboard" },
  { label: "Winners", href: "/super-admin/competition/winners" },
  { label: "Prize Distribution", href: "/super-admin/competition/prizes" },
];

export default function CompetitionAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Competition</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          Create and manage trading competitions, participants, leaderboards, and prizes.
        </p>
      </div>
      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 18,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {SUBNAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href.includes("/list") && pathname?.includes("/competition/") && pathname?.includes("/edit"));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                background: active ? "var(--primary, #0ea5e9)" : "var(--surface)",
                color: active ? "#fff" : "var(--text)",
                border: active ? "none" : "1px solid var(--border)",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
