export const SUPER_ADMIN_MODULES = [
  "Dashboard",
  "Users",
  "Advisors",
  "Buy Sell Trade Posts",
  "Community",
  "Reports",
  "AI & Compliance",
  "Analytics",
  "Subscriptions",
  "Finuer Pro Plans",
  "Sponsorship",
  "Payments",
  "Courses",
  // Stock Basket / AI Stock Picks retired — superseded by Finuer Basket.
  // "AI Stock Picks",
  "Finuer Basket",
  "Competition",
  "Notifications",
  "Audit Logs",
  "Settings",
  "Permissions",
] as const;

export const MODULE_ROUTE_MAP: Record<string, string> = {
  Dashboard: "/super-admin/dashboard",
  Users: "/super-admin/users",
  Advisors: "/super-admin/advisors",
  "Buy Sell Trade Posts": "/super-admin/market-posts",
  Community: "/super-admin/community",
  Reports: "/super-admin/reports",
  "AI & Compliance": "/super-admin/ai-compliance",
  "AI Agents": "/super-admin/agents",
  Analytics: "/super-admin/analytics",
  Subscriptions: "/super-admin/subscriptions",
  "Finuer Pro Plans": "/super-admin/plans",
  Sponsorship: "/super-admin/sponsorship",
  Payments: "/super-admin/payments",
  Courses: "/super-admin/courses",
  // "AI Stock Picks": "/super-admin/stock-picks",
  "Finuer Basket": "/super-admin/finuer-basket/baskets",
  Competition: "/super-admin/competition/list",
  Notifications: "/super-admin/notifications",
  "Audit Logs": "/super-admin/audit-logs",
  Settings: "/super-admin/settings",
  Permissions: "/super-admin/permissions",
};

/**
 * Sidebar navigation, grouped in a sensible operating order:
 * overview → people → content → AI → products → revenue → system.
 * This is the single source of nav truth (the old duplicate top-bar was removed).
 */
export const NAV_GROUPS: { heading: string; modules: string[] }[] = [
  { heading: "Overview", modules: ["Dashboard", "Analytics"] },
  { heading: "People", modules: ["Users", "Advisors", "Permissions"] },
  { heading: "Content", modules: ["Buy Sell Trade Posts", "Community", "Reports"] },
  { heading: "AI", modules: ["AI & Compliance", "AI Agents"] },
  {
    heading: "Products",
    // "AI Stock Picks" removed — superseded by Finuer Basket.
    modules: ["Finuer Basket", "Competition", "Courses"],
  },
  { heading: "Revenue", modules: ["Subscriptions", "Finuer Pro Plans", "Sponsorship", "Payments"] },
  { heading: "System", modules: ["Notifications", "Audit Logs", "Settings"] },
];

