export const ADMIN_MODULES = [
  "Dashboard",
  "Verification Queue",
  "Post Moderation",
  "Reports",
  "Users",
  "Audit Logs",
] as const;

export const ADMIN_MODULE_ROUTE_MAP: Record<string, string> = {
  Dashboard: "/admin/dashboard",
  "Verification Queue": "/admin/advisors",
  "Post Moderation": "/admin/market-posts",
  Reports: "/admin/reports",
  Users: "/admin/users",
  "Audit Logs": "/admin/audit-logs",
};
