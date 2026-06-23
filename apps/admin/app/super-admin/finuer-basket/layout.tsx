"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SUBNAV = [
  { label: "Markets", href: "/super-admin/finuer-basket/markets" },
  { label: "Types", href: "/super-admin/finuer-basket/types" },
  { label: "Benchmarks", href: "/super-admin/finuer-basket/benchmarks" },
  { label: "Basket List", href: "/super-admin/finuer-basket/baskets" },
  { label: "Create Basket", href: "/super-admin/finuer-basket/baskets/new" },
];

const SUBNAV_HINT =
  "After creating a basket, add constituent stocks from Basket List → Stocks.";

export default function FinuerBasketAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Finuer Basket</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          Manage markets, types, benchmarks, and curated investment baskets.
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>{SUBNAV_HINT}</p>
      </div>

      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {SUBNAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/super-admin/finuer-basket/baskets" &&
              pathname.startsWith("/super-admin/finuer-basket/baskets/") &&
              !pathname.endsWith("/new"));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                background: active ? "var(--primary, #0ea5e9)" : "var(--surface-2)",
                color: active ? "#fff" : "var(--text)",
                border: "1px solid var(--border)",
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
