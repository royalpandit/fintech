export const ADVISOR_MODULES = [
  "Dashboard",
  "Feed",
  "Buy Sell Trade Posts",
  "Comments",
  "Messages",
  "Subscription Services",
  // Virtual Trading is hidden from the professional sidebar for now — same call
  // as the investor panel, where /user/virtual-trading and Wallet came out of
  // the nav. /advisor/paper still builds and still works by URL; this only
  // removes the link. Uncomment here AND in the "Markets" group below.
  // "Virtual Trading",
  "Financial AI Agents",
  "Markets",
  "Watchlist",
  "Finuer Basket",
  "Competitions",
  "Courses",
  "Earnings",
  "Analytics",
  "Reports",
  "Notifications",
  "Profile",
] as const;

/**
 * Grouped sidebar navigation (single source of nav truth — the old duplicate
 * top-bar was removed). Ordered by how an advisor works: overview → content →
 * monetize → markets → inbox → account.
 */
export const ADVISOR_NAV_GROUPS: { heading: string; modules: string[] }[] = [
  { heading: "Overview", modules: ["Dashboard", "Analytics"] },
  { heading: "Content", modules: ["Feed", "Buy Sell Trade Posts", "Comments"] },
  { heading: "Monetize", modules: ["Subscription Services", "Reports", "Courses", "Earnings"] },
  {
    heading: "Markets",
    modules: [
      "Markets",
      "Watchlist",
      "Finuer Basket",
      // "Virtual Trading",   // see ADVISOR_MODULES above
      "Financial AI Agents",
      "Competitions",
    ],
  },
  { heading: "Inbox", modules: ["Messages", "Notifications"] },
  { heading: "Account", modules: ["Profile"] },
];

export const ADVISOR_MODULE_ROUTE_MAP: Record<string, string> = {
  Dashboard: "/advisor/dashboard",
  Feed: "/advisor/feed",
  "Buy Sell Trade Posts": "/advisor/posts",
  Comments: "/advisor/comments",
  Messages: "/advisor/messages",
  "Subscription Services": "/advisor/services",
  "Virtual Trading": "/advisor/paper",
  "Financial AI Agents": "/advisor/agents",
  Markets: "/advisor/markets",
  Watchlist: "/advisor/watchlist",
  "Finuer Basket": "/advisor/finuer-basket",
  Competitions: "/advisor/competition",
  Courses: "/advisor/courses",
  Earnings: "/advisor/earnings",
  Analytics: "/advisor/analytics",
  Reports: "/advisor/reports",
  Notifications: "/advisor/notifications",
  Profile: "/advisor/profile",
};
