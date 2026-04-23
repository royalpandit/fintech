export const ADVISOR_MODULES = [
  "Dashboard",
  "My Posts",
  "Comments",
  "Subscribers",
  "Courses",
  "Earnings",
  "Analytics",
  "Notifications",
  "Profile",
] as const;

export const ADVISOR_MODULE_ROUTE_MAP: Record<string, string> = {
  Dashboard: "/advisor/dashboard",
  "My Posts": "/advisor/posts",
  Comments: "/advisor/comments",
  Subscribers: "/advisor/subscribers",
  Courses: "/advisor/courses",
  Earnings: "/advisor/earnings",
  Analytics: "/advisor/analytics",
  Notifications: "/advisor/notifications",
  Profile: "/advisor/profile",
};
