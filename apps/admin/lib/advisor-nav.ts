export const ADVISOR_MODULES = [
  "Dashboard",
  "Feed",
  "Market Posts",
  "Comments",
  "Messages",
  "Subscription Services",
  "Virtual Trading",
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
  { heading: "Content", modules: ["Feed", "Market Posts", "Comments"] },
  { heading: "Monetize", modules: ["Subscription Services", "Reports", "Courses", "Earnings"] },
  {
    heading: "Markets",
    modules: ["Markets", "Watchlist", "Finuer Basket", "Virtual Trading", "Competitions"],
  },
  { heading: "Inbox", modules: ["Messages", "Notifications"] },
  { heading: "Account", modules: ["Profile"] },
];

export const ADVISOR_MODULE_ROUTE_MAP: Record<string, string> = {
  Dashboard: "/advisor/dashboard",
  Feed: "/advisor/feed",
  "Market Posts": "/advisor/posts",
  Comments: "/advisor/comments",
  Messages: "/advisor/messages",
  "Subscription Services": "/advisor/services",
  "Virtual Trading": "/advisor/paper",
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
