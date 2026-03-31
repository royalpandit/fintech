export const SUPER_ADMIN_MODULES = [
  "Dashboard",
  "Users",
  "Advisors",
  "Market Posts",
  "Community",
  "Reports",
  "AI & Compliance",
  "Analytics",
  "Payments",
  "Courses",
  "Notifications",
  "Audit Logs",
  "Settings",
  "Permissions",
] as const;

export const MODULE_ROUTE_MAP: Record<string, string> = {
  Dashboard: "/super-admin/dashboard",
  Users: "/super-admin/users",
  Advisors: "/super-admin/advisors",
  "Market Posts": "/super-admin/market-posts",
  Community: "/super-admin/community",
  Reports: "/super-admin/reports",
  "AI & Compliance": "/super-admin/ai-compliance",
  Analytics: "/super-admin/analytics",
  Payments: "/super-admin/payments",
  Courses: "/super-admin/courses",
  Notifications: "/super-admin/notifications",
  "Audit Logs": "/super-admin/audit-logs",
  Settings: "/super-admin/settings",
  Permissions: "/super-admin/permissions",
};

