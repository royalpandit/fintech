export const ADVISOR_MODULES = [
  "Dashboard",
  "Feed",
  "My Posts",
  "Comments",
  "Messages",
  "Subscribers",
  "Courses",
  "Earnings",
  "Analytics",
  "Reports",
  "Notifications",
  "Profile",
] as const;

export const ADVISOR_MODULE_ROUTE_MAP: Record<string, string> = {
  Dashboard: "/advisor/dashboard",
  Feed: "/advisor/feed",
  "My Posts": "/advisor/posts",
  Comments: "/advisor/comments",
  Messages: "/advisor/messages",
  Subscribers: "/advisor/subscribers",
  Courses: "/advisor/courses",
  Earnings: "/advisor/earnings",
  Analytics: "/advisor/analytics",
  Reports: "/advisor/reports",
  Notifications: "/advisor/notifications",
  Profile: "/advisor/profile",
};
